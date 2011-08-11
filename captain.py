#!/usr/bin/env python2.6
import json
import re
import sys


state = {
    'task': None,
    'queue': {},
    'failures': {},
    'completed': [],
}

# TODO: add a timestamp to every action


def main(stream):
    for line in stream:
        if line.startswith('Running '):
            if state['task']:
                state['completed'].append(state['task'])
            state['task'] = re.search("Running (.*)", line).group(1)
        elif re.match(r'^\[[^\]]+\]', line):
            host, kind, text = re.search(r'^\[([^\]]+)\] (\w+):\s*(.*)$', line).groups()
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
                state['failures'].setdefault(host, []).append((state['task'], text))
    print json.dumps(state)


if __name__ == '__main__':
    main(sys.stdin)
