const express = require('express')
const parse = require('csv-parse')
const fs = require('fs');
const PNF = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance(); // Get an instance of `PhoneNumberUtil`.
const app = express()

app.get('/', (req, res) => res.send('Hello World!'))

app.listen(8080, () => console.log('Example app listening on port 8080!'))


fs.readFile('input.csv', 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  parse(data, {}, function(err, output){
  	obj = []
  	usr_dict = {}

  	labels = make_labels(output[0])

	obj = []
  	usr_dict = {}
  	for (var i = 1; i < output.length; i++ ) {
  		id = output[i][1];
  		if( usr_dict[id] == undefined ){
  			user = make_user({}, output[i], labels)
  			obj.push(user)
  			usr_dict[id] = obj.length - 1
  		}
  		else {
  			user = obj[usr_dict[id]]
  			user = make_user(user, output[i], labels)
  			obj[usr_dict[id]] = user
  		} 

  	}
  	out = JSON.stringify(obj, null, 2); 
  	console.log(out);	
  	fs.writeFile('output.txt', out, (err) => {  
	    // throws an error, you could also catch it here
	    if (err) throw err;

	    // success case, the file was saved
	    console.log('saved JSON object into output.txt!');
	});
  });
});

function make_labels(head){
	labels = [] 
	for ( var i = 0; i < head.length; i ++ ){
		
		if( head[i].indexOf("email") != -1){
			addObj = {}
			addObj["type"] = "email"
			addObj["tags"] = get_tags(head[i])
			labels.push(addObj)
		}
		else if ( head[i].indexOf("phone") != -1 ) {
			addObj = {}
			addObj["type"] = "phone"
			addObj["tags"] = get_tags(head[i])
			labels.push(addObj)
		}
		else {
			labels.push(head[i])
		}
	}
	return labels

}

function make_user(usr, usr_info, labels){
	repeated_addr = {}
	for ( var i = 0; i < labels.length; i ++ ){
		if  ( usr_info[i] == ''){
			continue
		}

		if( labels[i].type == undefined ){
			/* Not address */
			/* fullname, eid, class, invisible, see all */

			/* Labels/"class" and undefined or "class" and "classes" undefined 			   */
			/* This is needed since "class" and "classes" are not the same 				   */ 
			/* Then, user["class"] will always be undefined, and the label need extra care */
			if( ( labels[i] != "class" && usr[labels[i]] != undefined) || (labels[i] === "class" && usr["classes"]!= undefined ) ){

				if( labels[i] === "class"){
					content = parse_content(usr_info[i])
					usr["classes"] = usr["classes"].concat(content)
				}

				/* Default value is already false. Change only if needed */
				if( labels[i] === "invisible" ){
					if ( usr_info[i] === "1" ){
						usr[labels[i]] = true
					}
				}
				if ( labels[i] === "see_all" ){
					if ( usr_info[i] === "yes" ){
						usr[labels[i]]= true
					}
				}
			}

			/* All the instances below are being declared for the first time in the usr obj */
			else{
				if( labels[i] === "class" ){
					content = parse_content(usr_info[i])
					usr["classes"] = content
				}
				else {
					if( labels[i] === "invisible" ){
						usr[labels[i]] = false
						if ( usr_info[i] === "1" ){
							usr[labels[i]] = true
						}
					}
					else if ( labels[i] === "see_all" ){
						usr[labels[i]] = false
						if ( usr_info[i] === "yes" ){
							usr[labels[i]]= true
						}
					}
					else {
						usr[labels[i]] = usr_info[i]
					}
				}
			}
			
		}
		else {
			/* object of type address */

			/* validate address */
			valid = true
			number = null
			content = [] 

			if( labels[i].type === "phone" ){
				try {
					number = phoneUtil.parseAndKeepRawInput(usr_info[i], 'BR');
				}
				catch (err){
					valid = false
					continue
				}
				if( !phoneUtil.isValidNumber(number))
					valid = false
				else {
					content.push(phoneUtil.format(number, PNF.E164))
					content[0] = content[0].slice(1)
				}
			}
			else if ( labels[i].type === "email"){
				content = parse_content(usr_info[i])
				for ( var j = 0; j < content.length; j ++ ){
					if( !validateEmail(content[j])){
						// Remobve the object from javascript 
						content.splice(j, 1)
					}
				}

			}
			else {
				/* Parse content */
				content = parse_content(usr_info[i])
				//content.push(usr_info[i])
			}

			if( !valid || content.length == 0)
				continue


			if ( usr.addresses == undefined ){
				usr.addresses = []
			}

			for( var j = 0; j < content.length; j ++ ){
				if( repeated_addr[content[j]] == undefined ){
					addr = { "type": labels[i].type,
						 "tags": labels[i].tags,
						 "address": content[j]
						}
					usr.addresses.push(addr)
					repeated_addr[content[j]] = usr.addresses.length - 1
				}
				else{
					usr.addresses[repeated_addr[content[j]]].tags = usr.addresses[repeated_addr[content[j]]].tags.concat(labels[i].tags)
					continue
				}
			}
		}
	}
	/*****************************************************************
	* Post processing
	*****************************************************************/

	/* Turn one instance lists into string for labels classes */
	if ( usr.classes != undefined && usr.classes.length == 1 ){
		usr.classes = usr.classes[0]
	}
	if ( usr.see_all == undefined )
		usr.see_all = false
	if( usr.invisible == undefined )
		usr.invisible = false

	return usr
}


function get_tags(label){
	array = label.split(/[ ,]+/)
	array.shift()
	return array
}


function parse_content(content){
	array = content.split(/[,;\/]+/)
	for ( var i = 0; i < array.length; i ++ ){
		array[i] = array[i].trim()
	}
	return array
}

function validateEmail(email) 
{
    var re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return re.test(email);
}
