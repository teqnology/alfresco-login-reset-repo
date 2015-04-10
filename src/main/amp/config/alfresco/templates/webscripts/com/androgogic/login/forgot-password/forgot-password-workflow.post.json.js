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
var key = parseInt(s["key"].toString(), 10);
var host = s["hostname"].toString();

function getRandomNum(lbound, ubound){
   return (Math.floor(Math.random() * (ubound - lbound)) + lbound);
}
function getAssignee(){
  return people.getPerson("admin");
}
function getRandomChar(){
   var chars = s["chars"].toString();
   return chars.charAt(getRandomNum(0, chars.length));
}
function getRandomId(n){
   var uniqueId = "";
   for (var i=0; i<n; i++){
      uniqueId += getRandomChar();
   }
   return uniqueId;
}
function startWorkflow(key){
  var workflow = actions.create("start-workflow");
  workflow.parameters.workflowName = "activiti$activitiAdhoc";
  workflow.parameters["bpm:workflowDescription"] = key;
  workflow.parameters["bpm:assignee"] = getAssignee();
  var futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 1);
  workflow.parameters["bpm:workflowDueDate"] = futureDate;
  logger.log("forgot-pasword workflow started with name: " + workflow.parameters.workflowName);
  return workflow.execute(companyhome);
}
function sendMailForgotPasswordWorkflow(u, emailcontent, key, activitiId){
  // create mail action
  var mail = actions.create("mail");
  mail.parameters.to = u.properties.email;
  mail.parameters.subject = "Alfresco - Reset Password Instructions";
  var map = new Object();
  map["email"] = u.properties.email;
  map["emailcontent"] = emailcontent;
  map["key"] = key;
  map["activitiId"] = activitiId;
  map["users"] = [];
  map["resetlink"] = "Reset Password";
  mail.parameters.template_model = map;   
  mail.parameters.template = companyhome.childByNamePath("Data Dictionary/Email Templates/andro-email-template/forgot-password-email.ftl");
  //mail.parameters.text = "We received a request to reset the password associated with this e-mail address. If you did not request your password to be reset, you can normally ignore this email."
  // execute action against a space
  mail.execute(companyhome);
  logger.log("forgot-password workflow mail -workflow start- sent to: " + u.properties.email);
  return mail;
}
function sendMailMultiUser(u, arr, emailcontent, key, activitiId){
  // create mail action
  var mail = actions.create("mail");
  mail.parameters.to = u.properties.email;
  mail.parameters.subject = "Alfresco - Reset Password Instructions";
  var map = new Object();
  map["email"] = u.properties.email;
  map["emailcontent"] = emailcontent;
  map["key"] = key;
  map["activitiId"] = activitiId;
  map["users"] = arr;
  map["resetlink"] = "Select account and reset password";
  mail.parameters.template_model = map;   
  mail.parameters.template = companyhome.childByNamePath("Data Dictionary/Email Templates/andro-email-template/forgot-password-email.ftl");
  //mail.parameters.text = "We received a request to reset the password associated with this e-mail address. We found multiple accounts bound with this account: " + arr.toString() + "."
  // execute action against a space
  logger.log("forgot-password workflow mail -multiple users found- sent to: " + u.properties.email);
  mail.execute(companyhome);
  return mail;
}
function getUsersByEmail(email){
  var filter = "email:" + email;
  users = people.getPeople(filter);
  return users;
}
function getUserbyUsername(username){
  return people.getPerson(username);
}
function getActivitiId(key){
    var activitiId;
    var k;
    var wf = workflow.getAssignedTasks();
    for(var w = 0; w < wf.length; w++){
      k = wf[w].properties["bpm:description"];
      if(k==key){
        activitiId = "activiti$" + wf[w].properties["bpm:taskId"];
        return activitiId;
      }else{
        activitiId = "";
      }
    }
    return activitiId;
}

function main(){

  var user, u, email, users, activitiId;
  logs = s["log"].toString() == "true";
  disallowedUsers = s["disallowed-users"].toString().split(",");
  key = getRandomId(key);

  logger.log("hostname: " + host);

  if ((json.isNull("email")) || (json.get("email") == null) || (json.get("email").length() == 0)){
    status.setCode(status.STATUS_BAD_REQUEST, "No email or username found");
    status.redirect = true;
    return;
  }

  email = json.get("email");

  if (email.indexOf("@") > -1){
    users = getUsersByEmail(email);
    if (users.length == 0){
      status.setCode(status.STATUS_BAD_REQUEST, "Unfortunately this account does not exist in our registered user list. Please try another email or contact your system administrator.");
      status.redirect = true;
      return;
    }else if (users.length > 1){
      var usersArray = [];
      for (var i = 0; i < users.length; i++) {
        user = search.findNode(users[i]);
        usersArray.push(user.properties.userName);
      }
      user = search.findNode(users[0]);
      startWorkflow(key);
      activitiId = getActivitiId(key);      
     // Send e-mail
     try{
      sendMailMultiUser(user, usersArray, "We found multiple accounts registered with this email. ", key, activitiId);
     } catch (e){
      status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, "The email with the instructions was not sent. Please retry or contact your system administrator. Here is the detailed error: " + e);
      status.redirect = true;
      return;
     }
    }else if (users.length == 1){
      user = search.findNode(users[0]);
      startWorkflow(key);
      activitiId = getActivitiId(key);
      // Send e-mail
      try{
        sendMailForgotPasswordWorkflow(user, "If you did not request your password to be reset, you can normally ignore this email.", key, activitiId);
      } catch (e){
        status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, "The email with the instructions was not sent. Please retry or contact your system administrator. Here is the detailed error: " + e);
        status.redirect = true;
        return;
      }
    }
  }else{
    user = getUserbyUsername(email);
    if(user){
      startWorkflow(key);
      activitiId = getActivitiId(key);
      // Send e-mail
      try{
        sendMailForgotPasswordWorkflow(user, "If you did not request your password to be reset, you can normally ignore this email.", key, activitiId);
      } catch (e){
        status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, "The email with the instructions was not sent. Please retry or contact your system administrator. Here is the detailed error: " + e);
        status.redirect = true;
        return;
      }
    }else{
      status.setCode(status.STATUS_BAD_REQUEST, "Unfortunately this account does not exist in our registered user list. Please try another username or contact your system administrator.");
      status.redirect = true;
      return;
    }
  }

}

main();