// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// tslint:disable:no-any
import { ChildProcess, spawn } from 'child_process';
import { SpawnOptions } from './types';

export class ProcessService {
    public async exec(file: string, args: string[], options: SpawnOptions = {}): Promise<{}> {
        const encoding = options.encoding = typeof options.encoding === 'string' && options.encoding.length > 0 ? options.encoding : 'utf8';
        delete options.encoding;
        const spawnOptions = { ...options };
        if (!spawnOptions.env || Object.keys(spawnOptions).length === 0) {
            spawnOptions.env = { ...process.env };
        }

        // Always ensure we have unbuffered output.
        spawnOptions.env.PYTHONUNBUFFERED = '1';
        if (!spawnOptions.env.PYTHONIOENCODING) {
            spawnOptions.env.PYTHONIOENCODING = 'utf-8';
        }
        let proc: ChildProcess;
        try {
            proc = spawn(file, args, spawnOptions);
        } catch (ex) {
            return Promise.reject(ex);
        }
        return new Promise((resolve, reject) => {

            const on = (ee: NodeJS.EventEmitter, name: string, fn: (...args: any[]) => void) => {
                ee.on(name, fn);
            };

            const stdoutBuffers: Buffer[] = [];
            on(proc.stdout, 'data', (data: Buffer) => stdoutBuffers.push(data));
            const stderrBuffers: Buffer[] = [];
            on(proc.stderr, 'data', (data: Buffer) => {
                if (options.mergeStdOutErr) {
                    stdoutBuffers.push(data);
                    stderrBuffers.push(data);
                } else {
                    stderrBuffers.push(data);
                }
            });

            proc.on('close', () => {
                const stderr: string | undefined = stderrBuffers.length === 0 ? undefined : Buffer.concat(stderrBuffers).toString();
                if (stderr && stderr.length > 0 && options.throwOnStdErr) {
                    reject(stderr);
                } else {
                    const stdout = Buffer.concat(stdoutBuffers).toString();
                    resolve({ stdout, stderr });
                }
            });
            proc.on('error', ex => {
                reject(ex);
            });
        });
    }
}

async function do_this() {
    const proc = new ProcessService();
    try {
        const output = await proc.exec('python2', ['-c', 'import sys;print(sys.executable)']);
        console.log(JSON.stringify(output));
    } catch (ex) {
        console.error('Failed with errors', ex);
    }
    console.log('Done');
}


do_this();
