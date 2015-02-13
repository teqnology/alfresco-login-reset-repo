model.result = false;
model.message = "";
var uName = args.username;
var newPwd = args.newpwd;

function getUserByUserName(username) {
   var user = people.getPerson(username);
   return user;
}

function resetPassword(username, password) {
	people.setPassword(username, password);
}

function main() {

	var user = people.getPerson(uName);

	if(user.properties["companyfax"] == newPwd){
		resetPassword(uName, newPwd);
		user.properties["companyfax"] = null;
		user.save();
	}else{
		status.setCode(status.STATUS_BAD_REQUEST, "Token not valid.");
		status.redirect = true;
		return;
	}

	model.success = false;
	model.result = false;

}

main();