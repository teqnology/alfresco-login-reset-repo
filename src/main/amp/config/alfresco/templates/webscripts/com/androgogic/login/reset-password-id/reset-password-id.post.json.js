model.result = false;
model.message = "";
var uName = json.get("username");
var token = json.get("token");

function getUserByUserName(username) {
   var user = people.getPerson(username);
   return user;
}

function resetPassword(username, password) {
	people.setPassword(username, password);
}

function main() {

	var user = people.getPerson(uName);

        if(user.properties["companyfax"] == token){
            if((json.isNull("newpwd")) || (json.get("newpwd") == null) || (json.get("newpwd").length() == 0)){
                    resetPassword(uName, token);
                }else{
                    var newPwd = json.get("newpwd");
                    resetPassword(uName, newPwd);
                    user.properties["companyfax"] = null;
                    user.save();
                }
        }

	model.success = true;
	model.result = true;

}

main();