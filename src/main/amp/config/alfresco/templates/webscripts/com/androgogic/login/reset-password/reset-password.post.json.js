/**
 * Reset User Password script
 * 
 * @method POST
 * @param json {string}
 *    {
 *       email: "email"
 *    }
 */
model.result = false;
model.message = "";
var s = new XML(config.script);

function getRandomNum(lbound, ubound)
{
   return (Math.floor(Math.random() * (ubound - lbound)) + lbound);
}
function getRandomChar()
{
   var chars = s["pw-chars"].toString();
   return chars.charAt(getRandomNum(0, chars.length));
}
function getRandomPassword(n)
{
   var password = "";
   for (var i=0; i<n; i++)
   {
      password += getRandomChar();
   }
   return password;
}
function resetPassword(u)
{
   var pwlen = parseInt(s["pw-length"].toString(), 10);
   // Auto-generate a password if not specified
   if (u.password == null || u.password == "")
   {
      u.password = getRandomPassword(pwlen);
   }
   var uToken = getUserByUserName(u.userName);
   uToken.properties["companyfax"] = u.password;
   uToken.save();
      //people.setPassword(u.userName, u.password);
   return u;
}
function mailResetPasswordNotification(u)
{
   // create mail action
   var mail = actions.create("mail");
   var fromName = person.properties.firstName + " " + person.properties.lastName;
   mail.parameters.to = u.email;
   mail.parameters.from = "admin@alfresco.com"
   mail.parameters.subject = "Alfresco Password Reset";
   var map = new Object();
   map["hostname"] = u.hostname;
   map["username"] = u.userName;
   map["password"] = u.password;
   map["firstname"] = u.firstName;
   map["fromname"] = fromName;
   map["email"] = u.email;
   map["mailtitle"] = "Alfresco Password Reset";
   mail.parameters.template_model = map;   
   mail.parameters.template = companyhome.childByNamePath("Data Dictionary/Email Templates/andro-email-template/reset-password-email.ftl");
   //mail.parameters.text = "Hello " + u.firstName+ ", You requested your password for your account to be reset. You can now log in to Alfresco with the following details. Username: " + u.userName + " - Password (please change after first login): " + u.password + "    If you did not request your password to be reset, you can normally ignore this email. Regards," + fromName;
   // execute action against a space
   mail.execute(companyhome);
   return mail;
}
function logResetPasswordResults(users)
{
   var logContent = "";
   for (var i=0; i<users.length; i++)
   {
      logContent += (users[i].userName + "," + users[i].password + "\n");
   }
   var d = new Date();
   var logFile = userhome.createFile("reset_password_" + d.getTime() + ".csv");
   logFile.content = logContent;
   logFile.save();
   return logFile;
}
function userToObject(u)
{
   return {
      "hostname" : s["hostname"].toString(),
      "firstName" : u.properties.firstName,
      "lastName" : u.properties.lastName,
      "email" : u.properties.email.toLowerCase(),
      "userName" : u.properties.userName,
      "password" : null
   };
}
function getUserByUserName(username)
{
   var uName = people.getPerson(username);
   return uName;
}
function getUsersByEmail(email)
{
   var filter = "email:" + email,
      maxResults = 10,
      peopleCollection = people.getPeople(filter, maxResults);
   return peopleCollection;
}

function userIsMember(u, g)
{
   var members = people.getMembers(g);
   for (var i=0; i<members.length; i++)
   {
      if (members[i].properties.userName == u.properties.userName)
      {
         return true;
      }
   }
   return false;
}
function main()
{
   var user, u, email, users, 
      logResults = s["log-resets"].toString() == "true", 
      disallowedUsers = s["disallowed-users"].toString().split(",");
   
   if ((json.isNull("email")) || (json.get("email") == null) || (json.get("email").length() == 0)) 
   {
      status.setCode(status.STATUS_BAD_REQUEST, "No email or username found");
      status.redirect = true;
      return;
   }
   
   email = json.get("email");

   if (email.indexOf("@") > -1){
      users = getUsersByEmail(email);

      if (users.length == 0) 
      {
         status.setCode(status.STATUS_NOT_FOUND, "No user found");
         status.redirect = true;
         return;
      }

      if (users.length > 1) 
      {
         var usersArray = [];
         for ( var i = 0; i < users.length; i++) {
            user = search.findNode(users[i]);
            usersArray.push(user.properties.userName);
         }
         status.setCode(status.STATUS_BAD_REQUEST, "Multiple users found. Please try to use one of the following: " + usersArray.toString());
         status.redirect = true;
         return;
      }
      user = search.findNode(users[0]);

   }else{
      user = getUserByUserName(email);
   }
   
   if (user == undefined || user == null){
      status.setCode(status.STATUS_BAD_REQUEST, "The account " + email + " was not found.");
      status.redirect = true;
      return;
   }
   if (!people.isAccountEnabled(user.properties.userName))
   {
      status.setCode(status.STATUS_FORBIDDEN, "This account seems to be disabled. Please contact your system administrator");
      status.redirect = true;
      return;
   }
   
   for ( var i = 0; i < disallowedUsers.length; i++)
   {
      if (user.properties.userName == disallowedUsers[i])
      {
         status.setCode(status.STATUS_FORBIDDEN, "This account can't use this feature. Please contact your system administrator");
         status.redirect = true;
         return;
      }
   }
   
   // Reset the password
   try
   {
      u = resetPassword(userToObject(user));
   }
   catch (e)
   {
      status.setCode(status.STATUS_BAD_REQUEST, "STATUS_BAD_REQUEST");
      status.redirect = true;
      return;
   }
   
   // Send e-mail confirmation
   try
   {
      mailResetPasswordNotification(u);
   }
   catch (e)
   {
      status.setCode(status.STATUS_INTERNAL_SERVER_ERROR, "The email with the new password was not sent. Please retry or contact your system administrator");
      status.redirect = true;
      return;
   }
   
   model.success = true;
   model.result = true;
   
   if (logResults)
   {
      model.resultsLog = logResetPasswordResults([u]);
   }
}

main();
