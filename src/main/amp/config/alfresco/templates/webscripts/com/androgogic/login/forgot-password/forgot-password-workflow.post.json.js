/**
* Workflow forgot password script
*
* @method POST
* @param
* {
*  email: ${email};
* }
*
*/

model.result = false;
model.message = "";
var s = new XML(config.script);
var key = parseInt(s.key.toString(), 10);
var host = s.hostname.toString();

function getRandomNum(lbound, ubound){
    return (Math.floor(Math.random() * (ubound - lbound)) + lbound);
}

function getAssignee(){
    return people.getPerson("admin");
}

function getRandomChar(){
    var chars = s.chars.toString();
    return chars.charAt(getRandomNum(0, chars.length));
}

function getRandomId(n){
    var uniqueId = "";
    for (var i=0; i<n; i++) {
        uniqueId += getRandomChar();
    }
    return uniqueId;
}

function startWorkflow(key, users){
    var workflow = actions.create("start-workflow");
    workflow.parameters.workflowName = "activiti$passwordReset";
    workflow.parameters["bpm:workflowDescription"] = key;
    workflow.parameters["agwf:workflowRelatedUsers"] = users.join(',');
    workflow.parameters["bpm:assignee"] = getAssignee();
    var futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    workflow.parameters["bpm:workflowDueDate"] = futureDate;
    workflow.execute(companyhome);
    logger.log("forgot-password workflow started with name: " + workflow.parameters.workflowName);
}

function getActivitiId(key){
    var activitiId = "";
    var k;
    var wf = workflow.getAssignedTasks();
    for (var w = 0; w < wf.length; w++) {
        k = wf[w].properties["bpm:description"];
        if (k==key) {
            activitiId = "activiti$" + wf[w].properties["bpm:taskId"];
        }
    }
    return activitiId;
}

function findLocalizedTemplate(mainTplName, locale){
    var localizedTplName = mainTplName.replace('.ftl', '_'+locale+'.ftl');
    var mailTemplates = search.xpathSearch('/app:company_home/app:dictionary/app:email_templates/cm:custom-email-template/cm:'+localizedTplName);
    if (mailTemplates.length === 0) {
        logger.log('Could not find localized template for '+mainTplName+', falling back to default');
        mailTemplates = search.xpathSearch('/app:company_home/app:dictionary/app:email_templates/cm:custom-email-template/cm:'+mainTplName);
    }
    if (mailTemplates.length > 0) {
        return mailTemplates[0];
    } else {
        throw 'Missing template: <Data Dictionary/Email Templates/custom-email-template/'+mainTplName+'>';
    }
}

function sendMailForgotPasswordWorkflow(email, username, users, key, activitiId, serverLocale){
    var mail = actions.create("mail");
    mail.parameters.to = email;
    mail.parameters.subject = msg.get("subject.text");
    // Maps an object with values to be used in the email templates as variables: (eg. ${username})
    var map = {};
    map.email = email;
    map.key = key;
    map.activitiId = activitiId;
    map.username = username;
    map.users = users;
    mail.parameters.template_model = map;

    mail.parameters.template = findLocalizedTemplate('forgot-password-email.ftl', serverLocale);

    mail.execute(companyhome);

    logger.log("forgot-password workflow mail -workflow start- sent to: " + email);
}

function getUsersByEmail(email){
    var filter = "email:" + email;
    return people.getPeople(filter);
}

function getUserbyUsername(username){
    return people.getPerson(username);
}

function isUserAllowed(u){
    for (var i = 0; i < disallowedUsers.length; i++) {
        if (u.properties.userName == disallowedUsers[i]) {
            status.setCode(status.STATUS_FORBIDDEN, msg.get("error.disallowedUser", [u]));
            status.redirect = true;
            return;
        }
    }
}

function areUsersAllowed(users){
    var disallowed = [];
    var user;
    for (var i = 0; i < users.length; i++) {
        for (var j = 0; j < disallowedUsers.length; j++) {
            user = search.findNode(users[i]);
            if (user.properties.userName == disallowedUsers[j]) {
                disallowed.push(user.properties.userName);
            }
        }
    }
    if (disallowed.length > 0) {
        var dis = disallowed.join(',');
        status.setCode(status.STATUS_FORBIDDEN, msg.get("error.disallowedUsers", [dis]));
        status.redirect = true;
        return;
    }
}

function isArgMissing(arg, message) {
    if (!json.has(arg) || json.isNull(arg) || json.get(arg).length() === 0) {
        status.setCode(status.STATUS_BAD_REQUEST, message + arg + '.');
        status.redirect = true;
        return true;
    }
}

function main(){

    var email, username, activitiId, user;
    var serverLocale = utils.getLocale();
    var usersArray = [];
    disallowedUsers = s['disallowed-users'].toString().split(",");
    key = getRandomId(key);

    // Returns error if no username or email is provided in the input field
    if (isArgMissing("email", msg.get("error.noEmailOrUsername"))) return;

    email = json.get("email");

    // If input value has "@" assumes it's an email.
    if (email.indexOf("@") > -1) {
        var users = getUsersByEmail(email);
        // Checks if "users" returns more than one result.
        if (users.length === 0) {
            status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noEmailFound"));
            status.redirect = true;
            return;
        } else if (users.length > 1) {
            areUsersAllowed(users);

            for (var i = 0; i < users.length; i++) {
                user = search.findNode(users[i]);
                usersArray.push(user.properties.userName);
            }

            // here we don't need specific properties to send the instructions
            // (email is already known)
            username = null;

            // start workflow and store details
            startWorkflow(key, usersArray);
            activitiId = getActivitiId(key);

            // register activitiId against all found users
            for (i = 0; i < usersArray.length; i++) {
                preferenceService.setPreferences(user, {com:{androgogic:{login:{key:key,activiti:activitiId}}}});
            }
        } else if (users.length == 1) {
            // If only one user is returned get user object
            user = search.findNode(users[0]);
            isUserAllowed(user);

            // store user properties to send the instructions
            // (email is already known)
            username = user.properties.userName;

            // start workflow and store details
            startWorkflow(key, [user.properties.userName]);
            activitiId = getActivitiId(key);
            preferenceService.setPreferences(user.properties.userName, {com:{androgogic:{login:{key:key,activiti:activitiId}}}});
        }
    } else {
        // If no "@" is found in the input value assume it's a username
        user = getUserbyUsername(email);

        if (user) {
            isUserAllowed(user);

            // store user properties to send the instructions
            email = user.properties.email;
            username = user.properties.userName;

            // start workflow and store details
            startWorkflow(key, [user.properties.userName]);
            activitiId = getActivitiId(key);
            preferenceService.setPreferences(user.properties.userName, {com:{androgogic:{login:{key:key,activiti:activitiId}}}});
        } else {
            status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noUser"));
            status.redirect = true;
            return;
        }
    }

    // Send the instruction email
    // If multiple users found we only send one email to the common related email address
    try {
        sendMailForgotPasswordWorkflow(email, username, usersArray, key, activitiId, serverLocale);
    } catch (e) {
        status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.mail", [e]));
        status.redirect = true;
        return;
    }

}

main();
