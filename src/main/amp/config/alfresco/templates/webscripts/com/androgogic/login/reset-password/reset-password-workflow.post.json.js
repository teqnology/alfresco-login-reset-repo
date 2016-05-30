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

function resetPassword(user, password){
   people.setPassword(user.properties.userName, password);
   return user;
}
function getUserbyUsername(username){
  return people.getPerson(username);
}
function getUserEmail(user){
  return user.properties.email.toLowerCase();
}

//TODO fix isActiviti check for improved security
function isActiviti(user, activitiId, key){
  var activiti = false;
  var a, userPref;
  var wf = workflow.getAssignedTasks();
  for(var w = 0; w < wf.length; w++){
    a = "activiti$" + wf[w].properties["bpm:taskId"];
    if(a==activitiId){
      userPref = preferenceService.getPreferences(user.properties.userName, "com.androgogic.login");
      if (userPref.com !== null){
        var userKey = userPref.com.androgogic.login.key;
        var userActiviti = userPref.com.androgogic.login.activiti;
        if(userKey==key && userActiviti==a){
          return true;
        }else{
          logger.log("reset-password-workflow failed password update for activiti request:  " + activitiId + ". Reason: either activitiID or key do not match with the original request.");
          return activiti;
        }
      }else{
        logger.log("reset-password-workflow failed password update for activiti request:  " + activitiId + ". Reason: preferenceService.getPreferences() did not return activiti and key values.");
        return activiti;
      }
    }
  }
  return activiti;
}

function closeActiviti(activitiId){
  var task = workflow.getTask(activitiId);
  task.endTask("Next");
}
function findLocalizedTemplate(mainTplName, locale){
  var localizedTplName = mainTplName.replace('.ftl', '_'+locale+'.ftl');
  var mailTemplates = search.xpathSearch('/app:company_home/app:dictionary/app:email_templates/cm:custom-email-template/cm:'+localizedTplName);
  if(mailTemplates.length === 0){
    logger.log('Could not find localized template for '+mainTplName+', falling back to default');
    mailTemplates = search.xpathSearch('/app:company_home/app:dictionary/app:email_templates/cm:custom-email-template/cm:'+mainTplName);
  }
  if(mailTemplates.length > 0){
    return mailTemplates[0];
  }else{
    throw 'Missing template: <Data Dictionary/Email Templates/custom-email-template/'+mainTplName+'>';
  }
}
function sendEmailResetPassword(email, emailcontent, serverLocale){
  // create mail action
  var mail = actions.create("mail");
  mail.parameters.to = email;
  mail.parameters.subject = msg.get("subject.text");
  var map = {};
  map.emailcontent = emailcontent;
  mail.parameters.template_model = map;
  mail.parameters.template = findLocalizedTemplate('reset-password-email.ftl', serverLocale);
  mail.execute(companyhome);
  logger.log("reset-password workflow mail -reset password- sent to: " + email);
}

function main(){

  var user, username, email, users, activitiId, key, allow;
  var serverLocale = utils.getLocale();

  if ((json.isNull("password")) || (json.get("password") === null) || (json.get("password").length() === 0)){
    status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noPassword"));
    status.redirect = true;
    return;
  }

  if ((json.isNull("username")) || (json.get("username") === null) || (json.get("username").length() === 0)){
    status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noUser"));
    status.redirect = true;
    return;
  }

  if ((json.isNull("activiti")) || (json.get("activiti") === null) || (json.get("activiti").length() === 0)){
    status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noRequest"));
    status.redirect = true;
    return;
  }

  if ((json.isNull("key")) || (json.get("key") === null) || (json.get("key").length() === 0)){
    status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noKey"));
    status.redirect = true;
    return;
  }

  username = json.get("username");
  password = json.get("password");
  key = json.get("key");
  activitiId = json.get("activiti");

  user = getUserbyUsername(username);
  email = getUserEmail(user);
  allow = isActiviti(user, activitiId, key);

  if(user && allow === true){
    logger.log("reset-password workflow request for username: " + username);
    // Reset password
    try{
      resetPassword(user, password);
      preferenceService.setPreferences(user.properties.userName, {com:{androgogic:{login:{key:"",activiti:""}}}});
      logger.log("reset-password workflow password updated for username: " + username);
    } catch (e){
      status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.noReset") + e);
      status.redirect = true;
      return;
    }
    // close activiti reset-password workflow
    try{
      closeActiviti(activitiId);
    } catch(e){
      status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.noWorkflow") + e);
      status.redirect = true;
      return;
    }
    // send email for password reset
    try{
      sendEmailResetPassword(email, msg.get('template.text', [username]), serverLocale);
    } catch (e){
      status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.mail") + e);
      status.redirect = true;
      return;
    }
  }else{
    logger.log("reset-password workflow failed password update for username: " + username + ". Reason: activitiId, key and username values don't match.");
    status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.allowed"));
    status.redirect = true;
    return;
  }

}

main();
