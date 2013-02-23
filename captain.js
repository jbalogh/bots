var TASK_RE = /^\[(.+?)] (Finished|Running) (.*)/;
var SUBTASK_RE = /^\[(.+?)\] \[(.+?)\] (\w+):\s*(.*)$/;

function parse_task(task_m, state) {
    var date=task_m[1], stat=task_m[2], task=task_m[3];
    if(stat == "Running"){
        state.task = [date, task];
    } else if(stat == "Finished") {
        state.completed.push(task.match(/(.+?) \(([\d\.]+)s\)/).slice(1));
    }
}

function parse_subtask(subtask_m, state) {
    var date = subtask_m[1],
        host = subtask_m[2],
        kind = subtask_m[3],
        text = subtask_m[4];
    if(kind == "running") {
        state.queue[host] = text;
    } else if(kind == "finished") {
        var res = text.match(/^(.*)\s+\((.*)\)$/);
        if(state.queue[host] == res[1]) {
            delete state.queue[host]; 
        }
    } else if(kind == "failed") {
        state["failed"].push(state.task[0], state.task[1], host, task);
    }
}

exports.parselog = function(stream) {
    state = {
        task: "",
        queue: {},
        failed: [],
        completed: []
    };
    var lines = stream.split("\n");
    for(var i=0; i < lines.length; i++) {
        var line = lines[i];

        var task_m = line.match(TASK_RE);
        var subtask_m = line.match(SUBTASK_RE);
        if(task_m) {
            parse_task(task_m, state);
        } else if(subtask_m) {
            parse_subtask(subtask_m, state);
        }
    }
    return state;
};
