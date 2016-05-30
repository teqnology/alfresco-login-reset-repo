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
    if(k==key && a==activitiId){
      return true;
    }
  }
  return activiti;
}

function main(){

  var email, users, activitiId, key, allow;

  if ((json.isNull("email")) || (json.get("email") === null) || (json.get("email").length() === 0)){
    status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.missingArgument") + "email.");
    status.redirect = true;
    return;
  }
  if ((json.isNull("activiti")) || (json.get("activiti") === null) || (json.get("activiti").length() === 0)){
    status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.missingArgument") + "activiti.");
    status.redirect = true;
    return;
  }
  if ((json.isNull("key")) || (json.get("key") === null) || (json.get("key").length() === 0)){
    status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.missingArgument") + "key.");
    status.redirect = true;
    return;
  }

  email = json.get("email");
  // Fix to FF and IE character escaping
  email = email.replace("%40","@");
  activitiId = json.get("activiti");
  key = json.get("key");
  users = getUsersByEmail(email);
  allow = isActiviti(activitiId, key);
  logger.log("allow reset-password for account " + email + " is set to: " + allow);
  if (allow === true){
    var usersArray = [];
    for (var i = 0; i < users.length; i++) {
      user = search.findNode(users[i]);
      usersArray.push(user.properties.userName);
      }
    model.users = usersArray;
  }else{
    status.setCode(status.STATUS_BAD_REQUEST, msg.get("error.noRequest") + email);
    status.redirect = true;
    return;
  }

}

main();
