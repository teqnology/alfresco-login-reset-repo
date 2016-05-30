/**
* Workflow reset password script
*
* @method POST
* @param
* {
*    password: ${password};
* }
*
*/

model.result = false;
model.message = "";

function resetPassword(user, password) {
    people.setPassword(user.properties.userName, password);
    return user;
}

function getUserbyUsername(username) {
    return people.getPerson(username);
}

function getUserEmail(user) {
    return user.properties.email.toLowerCase();
}

function isActiviti(user, activitiId, key) {
    var activiti = false;
    var k, a, userPref;
    var wf = workflow.getAssignedTasks();
    for (var w = 0; w < wf.length; w++) {
        a = "activiti$" + wf[w].properties["bpm:taskId"];
        k = wf[w].properties["bpm:description"];
        if (k == key && a == activitiId) {
            userPref = preferenceService.getPreferences(user.properties.userName, "com.androgogic.login");
            if ((userPref.com !== null) && ("key" in userPref.com.androgogic.login) && ("activiti" in userPref.com.androgogic.login)) {
                var userKey = userPref.com.androgogic.login.key;
                var userActiviti = userPref.com.androgogic.login.activiti;
                var workflowUsers = wf[w].properties["agwf:relatedUsers"].split(',');
                if (userKey == key && userActiviti == a && workflowUsers.indexOf(user.properties.userName) > -1) {
                    activiti = true;
                } else {
                    logger.log("reset-password-workflow failed password update for activiti request:  " + activitiId + ". Reason: either activitiID or key or user do not match with the original request.");
                }
            } else {
                logger.log("reset-password-workflow failed password update for activiti request:  " + activitiId + ". Reason: preferenceService.getPreferences() did not return activiti and key values.");
            }
        }
    }
    return activiti;
}

function closeActiviti(activitiId) {
    var task = workflow.getTask(activitiId);
    task.endTask("Next");
}

function findLocalizedTemplate(mainTplName, locale) {
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

function sendEmailResetPassword(email, username, serverLocale) {
    // create mail action
    var mail = actions.create("mail");
    mail.parameters.to = email;
    mail.parameters.subject = msg.get("subject.text");

    // Maps an object with values to be used in the email templates as variables: (eg. ${username})
    var map = {};
    map.email = email;
    map.username = username;
    mail.parameters.template_model = map;

    mail.parameters.template = findLocalizedTemplate('reset-password-email.ftl', serverLocale);

    mail.execute(companyhome);

    logger.log("reset-password workflow mail -reset password- sent to: " + email);
}

function isArgMissing(arg, message) {
    if (!json.has(arg) || json.isNull(arg) || json.get(arg).length() === 0) {
        status.setCode(status.STATUS_BAD_REQUEST, message + arg + '.');
        status.redirect = true;
        return true;
    }
}

function main() {

    var user, username, email, users, activitiId, key, allow;
    var serverLocale = utils.getLocale();

    if (isArgMissing("password", msg.get("error.noPassword"))) return;
    if (isArgMissing("username", msg.get("error.noUser"))) return;
    if (isArgMissing("activiti", msg.get("error.noRequest"))) return;
    if (isArgMissing("key", msg.get("error.noKey"))) return;

    username = json.get("username");
    password = json.get("password");
    key = json.get("key");
    activitiId = json.get("activiti");

    user = getUserbyUsername(username);
    email = getUserEmail(user);
    allow = isActiviti(user, activitiId, key);

    if (user && email && allow === true) {
        logger.log("reset-password workflow request for username: " + username);

        // Reset password
        try {
            resetPassword(user, password);

            preferenceService.setPreferences(user.properties.userName, {com:{androgogic:{login:{key:"",activiti:""}}}});

            logger.log("reset-password workflow password updated for username: " + username);
        } catch (e) {
            status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.noReset", [e]));
            status.redirect = true;
            return;
        }

        // close activiti reset-password workflow
        try {
            closeActiviti(activitiId);
        } catch(e) {
            status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.noWorkflow", [e]));
            status.redirect = true;
            return;
        }

        // send email for password reset
        try {
            sendEmailResetPassword(email, username, serverLocale);
        } catch (e) {
            status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.mail"[e]));
            status.redirect = true;
            return;
        }
    } else {
        logger.log("reset-password workflow failed password update for username: " + username + ". Reason: activitiId, key and username values don't match.");

        status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.allowed"));
        status.redirect = true;
        return;
    }

}

main();
