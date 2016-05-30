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

function getUserbyUsername(username){
    return people.getPerson(username);
}

function isActiviti(activitiId, key){
    var activiti = false;
    var k, a;
    var wf = workflow.getAssignedTasks();
    for(var w = 0; w < wf.length; w++){
        a = "activiti$" + wf[w].properties["bpm:taskId"];
        k = wf[w].properties["bpm:description"];
        if (k == key && a == activitiId) {
            activiti = wf[w].properties["agwf:relatedUsers"].split(',');
        }
    }
    return activiti;
}

function isArgMissing(arg) {
    if (!json.has(arg) || json.isNull(arg) || json.get(arg).length() === 0) {
        status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.missingArgument", [arg]));
        status.redirect = true;
        return true;
    }
}

function main() {

    var i, email, identifier, users, activitiId, key;

    if (isArgMissing("activiti")) return;
    if (isArgMissing("key")) return;

    activitiId = json.get("activiti");
    key = json.get("key");

    // Check if an email or username is provided, error otherwise
    if (json.has("email") && !json.isNull("email")) {
        email = json.get("email");
        users = [];
        // Fix for FF and IE character escaping
        identifier = email.replace("%40","@");
        // build users array
        var res = getUsersByEmail(identifier);
        for (i = 0; i < res.length; i++) {
            users.push(search.findNode(res[i]));
        }
    } else if (json.has("user") && !json.isNull("user")) {
        identifier = json.get("user");
        users = [getUserbyUsername(identifier)];
    } else {
        status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noEmailOrUser"));
        status.redirect = true;
        return;
    }

    var workflowUsers = isActiviti(activitiId, key);

    if (workflowUsers) {
        logger.log("reset-password for account " + identifier + " is allowed");
        for (i = 0; i < users.length; i++) {
            // Only consider user if it is allowed for the requested workflow
            if (workflowUsers.indexOf(users[i].properties.userName) > -1) {
                model.users.push(users[i].properties.userName);
            }
        }
        // model.users = usersArray;
    } else {
        logger.log("reset-password for account " + identifier + " is not allowed");
        status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noRequest", [identifier]));
        status.redirect = true;
        return;
    }

}

main();
