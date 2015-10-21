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
  var mail = actions.create("mail");
  mail.parameters.to = u.properties.email;
  mail.parameters.subject = msg.get("subject.text");
  // Maps an object with values to be used in the email templates as variables: (eg. ${emailcontent})
  var map = new Object();
  map["email"] = u.properties.email;
  map["emailcontent"] = emailcontent;
  map["key"] = key;
  map["activitiId"] = activitiId;
  map["users"] = [];
  map["resetlink"] = msg.get("template.resetLink");
  mail.parameters.template_model = map;
  /* Support for localization and fix for non-english Alfresco instances.Also fix to missing template */
  var mailTemplates = search.xpathSearch("/app:company_home/app:dictionary/app:email_templates/cm:custom-email-template/cm:forgot-password-email.ftl");
  //mail.parameters.template = companyhome.childByNamePath("Data Dictionary/Email Templates/custom-email-template/forgot-password-email.ftl");
  if(mailTemplates.length > 0){
    mail.parameters.template = mailTemplates[0];
  }else{
    mail.parameters.text = "Missing template: <Data Dictionary/Email Templates/custom-email-template/forgot-password-email.ftl>";
  }
  mail.execute(companyhome);
  logger.log("forgot-password workflow mail -workflow start- sent to: " + u.properties.email);
  return mail;
}
function sendMailMultiUser(u, arr, emailcontent, key, activitiId){
  var mail = actions.create("mail");
  mail.parameters.to = u.properties.email;
  mail.parameters.subject = msg.get("subject.text");
  // Maps an object with values to be used in the email templates as variables: (eg. ${emailcontent})
  var map = new Object();
  map["email"] = u.properties.email;
  map["emailcontent"] = emailcontent;
  map["key"] = key;
  map["activitiId"] = activitiId;
  map["users"] = arr;
  map["resetlink"] = msg.get("template.resetLinkMulti");
  mail.parameters.template_model = map;   
  /* Support for localization and fix for non-english Alfresco instances.Also fix to missing template */
  var mailTemplates = search.xpathSearch("/app:company_home/app:dictionary/app:email_templates/cm:custom-email-template/cm:forgot-password-email.ftl");
  //mail.parameters.template = companyhome.childByNamePath("Data Dictionary/Email Templates/custom-email-template/forgot-password-email.ftl");
  if(mailTemplates.length > 0){
    mail.parameters.template = mailTemplates[0];
  }else{
    mail.parameters.text = "Missing template: <Data Dictionary/Email Templates/custom-email-template/forgot-password-email.ftl>";
  }
  mail.execute(companyhome);
  logger.log("forgot-password workflow mail -multiple users found- sent to: " + u.properties.email);
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
function disallowedUser(u){
  for ( var i = 0; i < disallowedUsers.length; i++){
    if (u.properties.userName == disallowedUsers[i]){
       status.setCode(status.STATUS_FORBIDDEN, msg.get("error.disallowedUsers"));
       status.redirect = true;
       return;
     }
  }
}

function main(){

  var user, u, email, users, activitiId;
  disallowedUsers = s["disallowed-users"].toString().split(",");
  key = getRandomId(key);

  // Returns error if no username or email is provided in the input field
  if ((json.isNull("email")) || (json.get("email") == null) || (json.get("email").length() == 0)){
    status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noEmailOrUsername"));
    status.redirect = true;
    return;
  }

  email = json.get("email");

  // If input value has "@" assumes it's an email.
  if (email.indexOf("@") > -1){
    users = getUsersByEmail(email);
    // Checks if "users" returns more than one result.
    if (users.length == 0){
      status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noEmailFound"));
      status.redirect = true;
      return;
    }else if (users.length > 1){
      var usersArray = [];
      for (var i = 0; i < users.length; i++) {
        user = search.findNode(users[i]);
        usersArray.push(user.properties.userName);
      }
      // As the email is the same for all users in the array, get user object in order to send reset password instructions to the correct email.
      user = search.findNode(users[0]);
      disallowedUser(user);
      startWorkflow(key);
      activitiId = getActivitiId(key);
      // attempts to send the email
     try{
      sendMailMultiUser(user, usersArray, msg.get("template.multiple"), key, activitiId);
     } catch (e){
      status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.mail") + e);
      status.redirect = true;
      return;
     }
    }else if (users.length == 1){
      // If only one user is returned get user object and attempts to send the email
      user = search.findNode(users[0]);
      disallowedUser(user);
      startWorkflow(key);
      activitiId = getActivitiId(key);
      try{
        sendMailForgotPasswordWorkflow(user, msg.get("template.ignore"), key, activitiId);
      } catch (e){
        status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.mail") + e);
        status.redirect = true;
        return;
      }
    }
  }else{
    // If no "@" is found in the input value assume it's a username
    user = getUserbyUsername(email);
    if(user){
      disallowedUser(user);
      startWorkflow(key);
      activitiId = getActivitiId(key);
      // Send e-mail
      try{
        sendMailForgotPasswordWorkflow(user, msg.get("template.ignore"), key, activitiId);
      } catch (e){
        status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, msg.get("error.mail") + e);
        status.redirect = true;
        return;
      }
    }else{
      status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noUser"));
      status.redirect = true;
      return;
    }
  }

}

main();