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
function isActiviti(activitiId, key){
  var activiti = false;
  var k, a;
  var wf = workflow.getAssignedTasks();
  for(var w = 0; w < wf.length; w++){
    a = "activiti$" + wf[w].properties["bpm:taskId"];
    k = wf[w].properties["bpm:description"];
    if(k==key && a==activitiId){
      return activiti = true;
    }
  }
  return activiti;
}
function closeActiviti(activitiId){
  var task = workflow.getTask(activitiId);
  task.endTask("Next");
}
function sendEmailResetPassword(email, emailcontent){
  // create mail action
  var mail = actions.create("mail");
  mail.parameters.to = email;
  mail.parameters.subject = "Alfresco - Reset Password Request";
  var map = new Object();
  map["emailcontent"] = emailcontent;
  mail.parameters.template_model = map;   
  /* Support for localization and fix for non-english Alfresco instances.Also fix to missing template */
  var mailTemplates = search.xpathSearch("/app:company_home/app:dictionary/app:email_templates/cm:custom-email-template/forgot-password-email.ftl");
  //mail.parameters.template = companyhome.childByNamePath("Data Dictionary/Email Templates/custom-email-template/forgot-password-email.ftl");
  if(mailTemplates.length > 0){
    mail.parameters.template = mailTemplates[0];
  }else{
    mail.parameters.text = "Missing template: <Data Dictionary/Email Templates/custom-email-template/forgot-password-email.ftl>";
  }
  // execute action against a space
  mail.execute(companyhome);
  logger.log("reset-password workflow mail -reset password- sent to: " + email);
  return mail;
}

function main(){

  var user, username, email, users, activitiId, key, allow;

  if ((json.isNull("password")) || (json.get("password") == null) || (json.get("password").length() == 0)){
    status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noPassword"));
    status.redirect = true;
    return;
  }

  if ((json.isNull("username")) || (json.get("username") == null) || (json.get("username").length() == 0)){
    status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noUser"));
    status.redirect = true;
    return;
  }

  if ((json.isNull("activiti")) || (json.get("activiti") == null) || (json.get("activiti").length() == 0)){
    status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noRequest"));
    status.redirect = true;
    return;
  }

  if ((json.isNull("key")) || (json.get("key") == null) || (json.get("key").length() == 0)){
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
  allow = isActiviti(activitiId, key);

  if(user && allow==true){
    logger.log("reset-password workflow request for username: " + username);
    // Reset password
    try{
      resetPassword(user, password);
      logger.log("reset-password workflow password updated for username: " + username);
    } catch (e){
      status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.noReset") + e);
      status.redirect = true;
      return;
    };
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
      sendEmailResetPassword(email, "The password for the user: '" + username + "' has been successfully reset.");
    } catch (e){
      status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.noMail") + e);
      status.redirect = true;
      return;
    };
  }else{
    logger.log("reset-password workflow failed password update for username: " + username + ". Reason: activitiId, key and username values don't match.");
    status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.allowed"));
    status.redirect = true;
    return;    
  }

}

main();