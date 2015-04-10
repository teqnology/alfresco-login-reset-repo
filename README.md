Andro Custom Login
---

# Essentials 

- Alfresco Enterprise 4.2
- Alfresco Maven Version 1.1.1 ([Alfresco Maven compatibility matrix](http://docs.alfresco.com/5.0/concepts/alfresco-sdk-compatibility.html))
- Submodule `alfresco-custom-login-repo` (contains ACPs, back-end web scripts and logic to handle the entire reset password workflow)
- Submodule `alfresco-custom-login-share` (contains the front-end ftl pages, assets and client side code)
- Alfresco Maven Enterprise account to access the enterprise source code (otherwise the `pom.xml` need to be changed accordingly.

# Quickstart

- Locate the AMP files inside the path:
	- `andro-custom-login-repo/target/andro-custom-login-repo.amp`
	- `andro-custom-login-share/target/andro-custom-login-share.amp`
- Install the AMPs in their respective folders

# Quickstart for devs

- **andro-custom-login-repo**
	- go to the root of the project's folder and run: `mvn install`. This will download all the necessary source code.
	- run `mvn integration-test -Pamp-to-war`. This will setup the SDK and start Alfresco on the default port 8080.
- make sure Alfresco is up and running on http://localhost:8080/alfresco.
- (optional) import the project in your favorite IDE with Maven integration (eg. IntelliJ Idea) to develop against the project.

- **andro-custom-login-share**
	- go to the root of the project's folder and run: `mvn install`. This will download all the necessary source code.
	- run `mvn integration-test -Pamp-to-war -Dmaven.tomcat.port=8081`. This will setup the SDK and start Alfresco Share on port 8081 (not Alfresco Repository or Solr which should already be running on port 8080).
	- make sure Share is up and running on http://localhost:8081/share. NOTE: For this to work you need to have an Alfresco running on port 8080.
	- (optional) import the project in your favorite IDE with Maven integration (eg. IntelliJ Idea) to develop against the project.

- **(optional) working without andro-custom-login-repo**
	- often on local dev env there is no SMTP configuration. In order to test the project properly you might want to configure the `andro-custom-login-share` project to connect to a working remote repository. 
	- in case you want to make changes to the share-tier only, you can update the share config file  `andro-custom-login-share/src/main/resources/META-INF/share-config-custom.xml`. Just uncomment the `config evaluator="string-compare" condition="Remote">` section and update it's values accordingly.

# Source code documentation

## Alfresco Explorer Web Script family `/andro/base`

### `forgot-password-workflow`

This web script is triggered when the user requests a reset password through the `forgot-password` Share page. It checks on input provided, and sends an email (if any users is found) with a different message if the provided email is associated with one or multiple users. The web script will then create a new workflow generating a unique key and a unique activiti ID.
The email will contain a link to update the password, along with the previously generated unique key and the activiti ID. The link will be available for a one time use only. If not used, the link will expire in 24 hours automatically. 

- `POST /alfresco/service/andro/base/login/forgot-password`
- Creates a new workflow for the forgot password request
- xml configuration file

		<forgot-password>
			<key>16</key
			<chars>0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz</chars>
			<disallowed-users>admin</disallowed-users>
		</forgot-password>

- @method POST and @param `${email}` in JSON format. `${email}` accepts either standard email formatting (example@hostname.com) or a simple username.

		/**
		 * Workflow forgot password script
		 * 
		 * @method POST
		 * @param
		 * {
		 *    email: ${email};
		 * }
		 * 
		 */  

### `reset-password-workflow`

- `POST /alfresco/service/andro/base/login/reset-password`
- Resets the password for the selected user if the specified workflow exists.
- @method POST and @param `${password}`. The confirmation password check is executed client side before the ajax call.

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
- JSON result. The `${message}` is injected in the reset-password page notifying the user about the outcome of the password update.

		<#escape x as jsonUtils.encodeJSONString(x)>
		{
		   "success": ${result?string},
		   "message": "${message}"
		}
		</#escape>

### `list-users-workflow`

- POST /alfresco/service/andro/base/login/list-users
- Lists multiple users with the supplied email if the specified workflow exists
- @method POST and @param `${email}` in JSON format. `${email}` is used to find the list of users associated with that account and expose the list in the `reset-password` page

		/**
		 * Workflow reset password script
		 *    
		 * @method POST
		 * @param
		 * {
		 *     email: ${email};
		 * }
		 * 
		 * */

- JSON result. The array will contain either one entry (if a single users is returned) or an array of different users. Note that `${u}` is not the user object itself, but just the username string. 

		<#escape x as jsonUtils.encodeJSONString(x)>
		{
		   "success": ${result?string},
		   "message": "${message}",
		   "users": [
			   <#list users as u>
			   	{
		            "user": "${u}"
		        }<#if u_has_next>,</#if>
			   </#list>
		   ]
		}
		</#escape>

## ACP bootstrap

The HTML5 email templates are stored in the acp file inside `/src/main/amp/config/alfresco/bootstrap` folder.
There are two ACPs to be deployed:

- `andro-email-template-bootstrap.acp` which contains:
	- `forgot-password-email.ftl`
	- `reset-password-email.ftl`
	- will be exploded and deployed inside the `/Data Dictionary/Email Templates/andro-email-template` folder during the first restart after the AMP deployment. The emails are used by the forgot-password and reset-password web scripts.

- `end-workflow-bootstrap.acp` which contains:
	- `end-expired-workflow-script.js`
		
			<import resource="classpath:alfresco/module/andro-custom-login-repo/reset-password-workflow.js">
			endExpiredWorkflow();

	- it will be exploded and deployed inside the `/Data Dictionary/Scripts/` folder during the first restart after the AMP deployment. It contains a single script that will be called by the scheduled action described below.

## Scheduled Action

The bean id `endResetPasswordWorkflow` declared in `/src/main/amp/config/alfresco/reset-password-scheduled-action-services-context.xml` will be triggered every 10 minutes to check and close/end:
	- all the reset-password workflows that have been active for at least 24 hours
	- all the reset-password workflows that haven't been used in the last 24 hours
	- all the reset-password workflows that have been used and are currently in the completed state.

## Alfresco Custom Theme

The theme files are located in:

- `src/main/amp/config/alfresco/web-extension/site-data/themes` where the theme xml file is defined. The default one is called `androTheme.xml`. Use a similar one for a new theme deployment.
- `src/main/amp/web/themes/{nameAsXmlThemeFile}` (eg. `androTheme`) where all the theme's assets are stored. The structure reflects the original theme:
    - `/images` where theme images are stored.
    - `/yui/assets` where different ui components are stored
    - `/presentation.css` the main theme styling theme

###Share Login Theme

The login is no longer managed by the theme customization files. Now if the login page needs a restyling to reflect custom theme's UI, the files are located in:

- `src/main/amp/config/alfresco/templates/com/androgogic/base/login` where are stored `andro-login.ftl` and `andro-reset-password-id.ftl` (login and reset password pages)
- `src/main/amp/web/css/` where style and css files are stored. Each file has the same name as the page where it's recalled (eg `andro-login.css` and `andro-login.ftl`). Remember that `andro-login.css` overrides the `materialize.min.css` styling rules.
- `src/main/amp/web/js/` where script files are stored . Each file has the same name as the page where it's recalled (eg `andro-login.js` and `andro-login.ftl`).


## Alfresco Share custom login extension

This is a completely new page, based on `materializecss` project (currently Alpha 0.96.1), with an `andro-login.js` controller.
The controller calls a public web script:

	function getServer() {
	    var srv = remote.call("/api/server")
	    if (srv.status == 200) {
	      srvObj = eval("(" + srv + ")");
	      model.srv = srvObj;
	    }
	}
and injects `model.srv` data into the html login page.

This allows the Share login page to prompt users with a message if the Alfresco repository is down or unreachable.

In order to override the default login page, `share-config-custom.xml` needs to be updated as follows:

	<alfresco-config>
	   <config evaluator="string-compare" condition="WebFramework">
	      <web-framework>
	         <defaults>
	            <page-type>
	               <id>login</id>
	               <page-instance-id>andro-login</page-instance-id>
	            </page-type>
	         </defaults>
	      </web-framework>
	   </config>
	</alfresco-config>

> Written with [StackEdit](https://stackedit.io/).