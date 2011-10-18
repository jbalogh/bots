#!/usr/bin/env python2.6
"""
Parse logs from chief. pushbot uses this to talk about log files.
"""
from datetime import datetime
import json
import re
import sys
import time


DATEFMT = '%Y-%m-%d %H:%M:%S'
BRACKET_RE = r'\[([^\]]+)\]'
# [2011-09-23 08:03:14] Running pre_update
TASK_RE = r'^%s Running (.*)' % BRACKET_RE
# [2011-09-23 08:03:14] [localhost] running: date
SUBTASK_RE = r'^%s %s (\w+):\s*(.*)$' % (BRACKET_RE, BRACKET_RE)

# The parsed logs are given a bit more structure and thrown into this
# structure, which eventually gets dumped into json.
state = {
    # The currently running task: (timestamp started, task name).
    'task': None,
    # The shell operations the current task is waiting on: {host: subtask}.
    'queue': {},
    # List of failed tasks: (timestamp, task name, host, failure text).
    'failed': [],
    # List of completed tasks: (task name, elapsed time).
    'completed': [],
}


def elapsed(start, stop):
    """Turn datetime strings into numbers and subtract them."""
    a, b = map(lambda x: time.mktime(datetime.strptime(x, DATEFMT).timetuple()),
               [start, stop])
    return int(b - a)


def main(stream):
    for line in stream:
        if re.match(TASK_RE, line):
            date, task = re.search(TASK_RE, line).groups()
            # Move the existing task to the completed queue.
            if state['task']:
                prev_time, prev_task = state['task']
                state['completed'].append((prev_task, elapsed(prev_time, date)))
            state['task'] = (date, task)
        elif re.match(SUBTASK_RE, line):
            date, host, kind, text = re.search(SUBTASK_RE, line).groups()
            if kind == 'running':
                # Add it to the list of running subtasks.
                state['queue'][host] = text.strip()
            elif kind == 'finished':
                # Remove it from the list of running subtasks.
                msg, time = re.match('^(.*)\s+\((.*)\)$', text).groups()
                if state['queue'].get(host).strip() == msg.strip():
                    del state['queue'][host]
            elif kind == 'failed':
                # Add it to the list of failed tasks.
                date, task = state['task']
                state['failed'].append([date, task, host, text])
    print json.dumps(state)


if __name__ == '__main__':
    main(sys.stdin)
