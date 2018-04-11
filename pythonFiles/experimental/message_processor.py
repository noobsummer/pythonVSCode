# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License.

import atexit
import os
import platform
import signal
import socket
import threading
import warnings

from ptvsd.daemon import DaemonClosedError
from ptvsd import ipcjson, __version__
from ptvsd.socket import close_socket
from ptvsd.wrapper import WAIT_FOR_DISCONNECT_REQUEST_TIMEOUT, WAIT_FOR_THREAD_FINISH_TIMEOUT


class Daemon(object):
    """The process-level manager for the VSC protocol debug adapter."""

    exitcode = 0
    exiting_via_exit_handler = False

    def __init__(self,
                 notify_launch=lambda: None,
                 addhandlers=True,
                 killonclose=True):
        self.addhandlers = addhandlers
        self.killonclose = killonclose
        self._notify_launch = notify_launch

        self._closed = False
        self._client = None
        self._adapter = None

    def start(self, server=None):
        if self._closed:
            raise DaemonClosedError()
        return None

    def set_connection(self, client):
        """Set the client socket to use for the debug adapter.

        A VSC message loop is started for the client.
        """
        if self._closed:
            raise DaemonClosedError()
        if self._client is not None:
            raise RuntimeError('connection already set')
        self._client = client

        self._adapter = VSCodeMessageProcessor(
            client,
            self._notify_launch,
            self._handle_vsc_disconnect,
            self._handle_vsc_close,
        )
        self._adapter.start()
        if self.addhandlers:
            self._add_atexit_handler()
            self._set_signal_handlers()
        return self._adapter

    def close(self):
        """Stop all loops and release all resources."""
        if self._closed:
            raise DaemonClosedError('already closed')
        self._closed = True

        if self._client is not None:
            self._release_connection()

    # internal methods

    def _add_atexit_handler(self):
        def handler():
            self.exiting_via_exit_handler = True
            if not self._closed:
                self.close()
            if self._adapter is not None:
                self._adapter._wait_for_server_thread()

        atexit.register(handler)

    def _set_signal_handlers(self):
        if platform.system() == 'Windows':
            return None

        def handler(signum, frame):
            if not self._closed:
                self.close()
            sys.exit(0)

        signal.signal(signal.SIGHUP, handler)

    def _release_connection(self):
        if self._adapter is not None:
            self._adapter.handle_stopped(self.exitcode)
            self._adapter.close()
        close_socket(self._client)

    # internal methods for VSCodeMessageProcessor

    def _handle_vsc_disconnect(self, kill=False):
        if not self._closed:
            self.close()
        if kill and self.killonclose and not self.exiting_via_exit_handler:
            os.kill(os.getpid(), signal.SIGTERM)

    def _handle_vsc_close(self):
        if self._closed:
            return
        self.close()


class VSCodeMessageProcessor(ipcjson.SocketIO, ipcjson.IpcChannel):
    """IPC JSON message processor for VSC debugger protocol.

    This translates between the VSC debugger protocol and the pydevd
    protocol.
    """

    def __init__(
            self,
            socket,
            notify_launch=lambda: None,
            notify_disconnecting=lambda: None,
            notify_closing=lambda: None,
            logfile=None,
    ):
        super(VSCodeMessageProcessor, self).__init__(
            socket=socket, own_socket=False, logfile=logfile)
        self._socket = socket
        self._notify_launch = notify_launch
        self._notify_disconnecting = notify_disconnecting
        self._notify_closing = notify_closing

        self.server_thread = None
        self._closed = False

        # adapter state
        self.disconnect_request = None
        self.disconnect_request_event = threading.Event()
        self._exited = False

    def start(self):
        # VSC msg processing loop
        self.server_thread = threading.Thread(
            target=self.process_messages,
            name='ptvsd.Client1234',
        )
        self.server_thread.daemon = True
        self.server_thread.start()

        # special initialization
        self.send_event(
            'output',
            category='telemetry',
            output='ptvsd',
            data={
                'version': __version__,
                'nodebug': True
            },
        )

    # closing the adapter

    def close(self):
        """Stop the message processor and release its resources."""
        if self._closed:
            return
        self._closed = True

        self._notify_closing()
        # Close the editor-side socket.
        self._stop_vsc_message_loop()

    def _stop_vsc_message_loop(self):
        self.set_exit()
        if self._socket:
            try:
                self._socket.shutdown(socket.SHUT_RDWR)
                self._socket.close()
            except:
                pass

    def _wait_for_server_thread(self):
        if self.server_thread is None:
            return
        if not self.server_thread.is_alive():
            return
        self.server_thread.join(WAIT_FOR_THREAD_FINISH_TIMEOUT)

    def handle_stopped(self, exitcode):
        """Finalize the protocol connection."""
        if self._exited:
            return
        self._exited = True

        # Notify the editor that the "debuggee" (e.g. script, app) exited.
        self.send_event('exited', exitCode=exitcode)

        # Notify the editor that the debugger has stopped.
        self.send_event('terminated')

        # The editor will send a "disconnect" request at this point.
        self._wait_for_disconnect()

    def _wait_for_disconnect(self, timeout=None):
        if timeout is None:
            timeout = WAIT_FOR_DISCONNECT_REQUEST_TIMEOUT

        if not self.disconnect_request_event.wait(timeout):
            warnings.warn('timed out waiting for disconnect request')
        if self.disconnect_request is not None:
            self.send_response(self.disconnect_request)
            self.disconnect_request = None

    def _handle_disconnect(self, request):
        self.disconnect_request = request
        self.disconnect_request_event.set()
        self._notify_disconnecting(not self._closed)
        if not self._closed:
            self.close()

    # VSC protocol handlers

    def on_initialize(self, request, args):
        # TODO: docstring
        self.send_response(
            request,
            supportsExceptionInfoRequest=True,
            supportsConfigurationDoneRequest=True,
            supportsConditionalBreakpoints=True,
            supportsSetVariable=True,
            supportsExceptionOptions=True,
            supportsEvaluateForHovers=True,
            supportsValueFormattingOptions=True,
            supportsSetExpression=True,
            supportsModulesRequest=True,
            exceptionBreakpointFilters=[
                {
                    'filter': 'raised',
                    'label': 'Raised Exceptions',
                    'default': False
                },
                {
                    'filter': 'uncaught',
                    'label': 'Uncaught Exceptions',
                    'default': True
                },
            ],
        )
        self.send_event('initialized')

    def on_configurationDone(self, request, args):
        self.send_response(request)

    def on_launch(self, request, args):
        self._notify_launch()
        self.send_response(request)

    def on_disconnect(self, request, args):
        self._handle_disconnect(request)

    def on_invalid_request(self, request, args):
        self.send_response(request, success=True)
