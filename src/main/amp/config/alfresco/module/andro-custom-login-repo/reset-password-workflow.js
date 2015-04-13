var today = new Date();
function endExpiredWorkflow(){
    var t, a, k, d;
    var wf = workflow.getAssignedTasks();
    for(var i = 0; i < wf.length; i++){
        a = "activiti$" + wf[i].properties["bpm:taskId"];
        k = wf[i].properties["bpm:description"];
        d = wf[i].properties["bpm:dueDate"];
        n = today.getTime();
        d = d.getTime();
        if(n>d){
            var t = workflow.getTask(a);
            t.endTask("Next");
            logger.log("activiti workflow ended. Task id: " + a + ". Activiti key: " + k);
        }
    }
}