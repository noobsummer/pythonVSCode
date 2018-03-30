print("step1")
import sys
import threading
import time
print("step2")

def bar():
    print("step2-{},bar".format(threading.current_thread().getName()))
    time.sleep(2)
    print("print-{},bar".format(threading.current_thread().getName()))

def foo(x):
    while True:
        print("step2-{},foo-loop".format(threading.current_thread().getName()))
        bar()
print("step3")
threading.Thread(target=lambda: foo(2), name="foo").start()
print("step4")
foo(1)
print("step5")
