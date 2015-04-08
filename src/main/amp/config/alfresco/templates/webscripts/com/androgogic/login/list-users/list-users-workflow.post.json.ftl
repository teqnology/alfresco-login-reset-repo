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