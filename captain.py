#!/usr/bin/env python2.6
from datetime import datetime
import json
import re
import sys
import time


DATEFMT = '%Y-%m-%d %H:%M:%S'

state = {
    'task': None,
    'queue': {},
    'failed': [],
    'completed': [],
}


def elapsed(start, stop):
    a, b = map(lambda x: time.mktime(datetime.strptime(x, DATEFMT).timetuple()),
               [start, stop])
    return int(b - a)

def main(stream):
    for line in stream:
        if re.match('^\[[^\]]+\] Running', line):
            date, task = re.search('^\[([^\]]+)\] Running (.*)', line).groups()
            if state['task']:
                state['completed'].append((state['task'][1],
                                           elapsed(state['task'][0], date)))
            state['task'] = (date, task)
        elif re.match(r'^(\[[^\]]+\] ){2}', line):
            date, host, kind, text = re.search(r'^\[([^\]]+)\] \[([^\]]+)\] (\w+):\s*(.*)$', line).groups()
            if kind == 'running':
                state['queue'][host] = text.strip()
            elif kind == 'finished':
                msg, time = re.match('^(.*)\s+\((.*)\)$', text).groups()
                if state['queue'].get(host).strip() == msg.strip():
                    del state['queue'][host]
                if host == 'localhost':
                    pass
                    #print time, msg
            elif kind == 'failed':
                date, task = state['task']
                state['failed'].append([date, task, host, text])
    # Add the final task using whatever date we saw last.
    state['completed'].append((state['task'][1], elapsed(state['task'][0], date)))
    print json.dumps(state)


if __name__ == '__main__':
    main(sys.stdin)
