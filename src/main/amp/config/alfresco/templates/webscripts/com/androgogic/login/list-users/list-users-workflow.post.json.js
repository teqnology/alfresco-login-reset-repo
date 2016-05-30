/**
* Workflow reset password script
*
* @method POST
* @param
* {
*  email: ${email};
* }
* *
* */

model.result = false;
model.message = "";
model.users = [];

function getUsersByEmail(email){
    var filter = "email:" + email;
    users = people.getPeople(filter);
    return users;
}

function isActiviti(activitiId, key){
    var activiti = false;
    var k, a;
    var wf = workflow.getAssignedTasks();
    for(var w = 0; w < wf.length; w++){
        a = "activiti$" + wf[w].properties["bpm:taskId"];
        k = wf[w].properties["bpm:description"];
        if (k==key && a==activitiId) {
            activiti = true;
        }
    }
    return activiti;
}

function isArgMissing(json, arg) {
    if ((json.isNull(arg)) || (json.get(arg) === null) || (json.get(arg).length() === 0)) {
        status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.missingArgument") + arg + '.');
        status.redirect = true;
        return true;
    }
    return false;
}

function main(){

    var email, users, activitiId, key, allow;

    if (isArgMissing(json, "email")) return;
    if (isArgMissing(json, "activiti")) return;
    if (isArgMissing(json, "key")) return;

    email = json.get("email");
    // Fix for FF and IE character escaping
    email = email.replace("%40","@");
    activitiId = json.get("activiti");
    key = json.get("key");

    users = getUsersByEmail(email);
    allow = isActiviti(activitiId, key);
    logger.log("allow reset-password for account " + email + " is set to: " + allow);

    if (allow === true) {
        var usersArray = [];
        for (var i = 0; i < users.length; i++) {
            user = search.findNode(users[i]);
            usersArray.push(user.properties.userName);
        }
        model.users = usersArray;
    } else {
        status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noRequest") + email);
        status.redirect = true;
        return;
    }

}

main();
