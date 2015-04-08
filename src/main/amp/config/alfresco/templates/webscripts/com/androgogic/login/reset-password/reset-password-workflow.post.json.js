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

function checkValue(value){
  if ((json.isNull(value)) || (json.get(value) == null) || (json.get(value).length() == 0)){
    status.setCode(status.STATUS_BAD_REQUEST, "The following value is missing: " + value);
    status.redirect = true;
    return;
  }
} 
function resetPassword(user, password){
   if (password == null || password == ""){
     people.setPassword(user.userName, password);
   }
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
  mail.parameters.from = "noreply@alfresco.com";
  mail.parameters.subject = "Alfresco - Reset Password Request";
  var map = new Object();
  map["emailcontent"] = emailcontent;
  mail.parameters.template_model = map;   
  mail.parameters.template = companyhome.childByNamePath("Data Dictionary/Email Templates/andro-email-template/reset-password-email.ftl");
  // execute action against a space
  mail.execute(companyhome);
  logger.log("reset-password workflow mail -reset password- sent to: " + email);
  return mail;
}

function main(){

  var user, username, email, users, activitiId, key, allow;

  if ((json.isNull("password")) || (json.get("password") == null) || (json.get("password").length() == 0)){
    status.setCode(status.STATUS_BAD_REQUEST, "No password has been specified.");
    status.redirect = true;
    return;
  }

  if ((json.isNull("username")) || (json.get("username") == null) || (json.get("username").length() == 0)){
    status.setCode(status.STATUS_BAD_REQUEST, "No user found.");
    status.redirect = true;
    return;
  }

  if ((json.isNull("activiti")) || (json.get("activiti") == null) || (json.get("activiti").length() == 0)){
    status.setCode(status.STATUS_BAD_REQUEST, "No request for the password reset found.");
    status.redirect = true;
    return;
  }

  if ((json.isNull("key")) || (json.get("key") == null) || (json.get("key").length() == 0)){
    status.setCode(status.STATUS_BAD_REQUEST, "Invalid key for reset password request.");
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
      logger.log("reset-password workflow password udated for username: " + username);
    } catch (e){
      status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, "The password was not reset. Here is the detailed error: " + e);
      status.redirect = true;
      return;
    };
    // close activiti reset-password workflow    
    try{
      closeActiviti(activitiId);
    } catch(e){
      status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, "The reset password workflow wasn't ended. Here is the detailed error: " + e);
      status.redirect = true;
      return;
    }
    // send email for password reset
    try{
      sendEmailResetPassword(email, "The password for the user: '" + username + "' has been successfully reset.");
    } catch (e){
      status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, "The confirmation email was not sent. Here is the detailed error: " + e);
      status.redirect = true;
      return;
    };
  }else{
    logger.log("reset-password workflow failed password update for username: " + username + ". Reason: activitiId, key and username values don't match.");
    status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, "Failed to update the pasword. Either the user doesn't exist or your request is no more valid.");
    status.redirect = true;
    return;    
  }

}

main();