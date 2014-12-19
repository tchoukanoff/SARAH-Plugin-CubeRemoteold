/*__________________________________________________
|                CubeRemote v0.9                    |
|                                                   |
| Author : Boris Loizeau & Phil Bri (12/2014)       |
|    (See http://encausse.wordpress.com/s-a-r-a-h/) |
| Description :                                     |
|    Canalsat 'Le Cube' Plugin for SARAH project    |
|___________________________________________________|
*/

var cfg;

exports.init = function ( SARAH ) {
	var config = SARAH.ConfigManager.getConfig();
	cfg = config.modules.CubeRemote;

	if ( ! cfg.Cube_IP ) return console.log( 'CubeRemote => Config [ERREUR] : ip non paramétrée !\r\n' );

	// Finding Cube UUID :8080/BasicDeviceDescription.xml 	:49152/stbdevice.xml
	var req = require( 'http' ).get ( 'http://' + cfg.Cube_IP + ':49152/stbdevice.xml', function ( res ) {
		res.setEncoding ( 'utf-8' );

		res.on ( 'data', function ( chunk ) {

			cfg.Cube_UUID = /<UDN>(.*?)<\/UDN>/gmi.exec( chunk )[1];
			console.log ( '\nCubeRemote => Config [OK] : \rIP = ' + cfg.Cube_IP + ' \rUUID = ' + cfg.Cube_UUID + '\n' );
		});
    });

    req.on ( 'error', function ( error ) { console.log ( '\nCubeRemote => Config [ERREUR] : IP = Incorrecte !' );});
}

exports.action = function ( data , callback , config , SARAH ) {

	if ( ! cfg.Cube_IP ) return callback ({ 'tts' : 'Adresse I P non paramétrée' });

	if ( ! cfg.Cube_UUID ) {

		console.log ( '\nCubeRemote => Config [ERREUR] : UUID absent = Erreur ip ou Cube incompatible !' );
		return callback ({ 'tts' : 'I P incorrecte ou Cube incompatible avec SARAH' });
	}

	switch ( data.CubeAction ) {

		case 'UnregisterSmartPhone' :
		case 'IsRegisteredSmartPhone' :
		case 'RequestPairing' :
		case 'RegisterSmartPhone' :
			//if ( cfg.Linked == 'OK' ) return callback ({ 'tts' : 'Le cube est déjà appairé' });
			var CubeUrn = 'schemas-nds-com:service:Registration:1#';
			var CubeUrl = '/RegistrationService/control/';
			if ( data.CubeAction == 'RegisterSmartPhone' ){
				var CubeTag = 'pairingData';
				var CubeKey = cfg.Code_Appairage;
			}
			break;
		case 'SendKey' :
			//if ( typeof cfg.Linked == 'undefined' ) return callback ({ 'tts' : "Commande impossible; le Cube n'est pas appairé" });
			var CubeUrn = 'schemas-nds-com:service:Remote-Control:1#';
			var CubeUrl = '/RemoteControlService/control/';
			var CubeTag = 'key';
			var CubeKey = data.CubeKey;
			break;
		case 'SetSelectedChannel' :
			//if ( typeof cfg.Linked == 'undefined' ) return callback ({ 'tts' : "Commande impossible; le Cube n'est pas appairé" });
			var CubeUrn = 'schemas-nds-com:service:Channel-Selection:1#';
			var CubeUrl = '/ChannelSelectionService/control/';
			var CubeTag = 'channelNumber';
			var CubeExt = data.CubeKey.split ( '-' );
			var CubeKey = CubeExt[0];
			break;
		case 'GetVolumeState' :
			var CubeUrn = 'schemas-nds-com:service:Volume:1#';
			var CubeUrl = '/VolumeService/control/';
		break;

		default :
			return callback ({ 'tts' : 'Commande inconnue, vérifiez le fichier X M L' });
	}

	// Making xml body
	var body  = '<?xml version="1.0" encoding="utf-8"?>'
		body += '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
		body +=		'<s:Body>'
		body +=			'<u:'+ data.CubeAction +' xmlns:u="urn:' + CubeUrn + '">'
		body +=				'<uuid>' + cfg.Cube_UUID + '</uuid>';

	if ( typeof CubeExt != 'undefined' ) {
		body += '<channelListId>' + CubeExt[1] + '</channelListId>'
		body += '<locator>dvb://' + CubeExt[2] + '</locator>' }

	if ( typeof CubeTag != 'undefined' ) body += '<' + CubeTag + '>' + CubeKey + '</' + CubeTag + '>';

		body +=				'<executionStatus>0</executionStatus>'
		body +=			'</u:'+ data.CubeAction +">"
		body +=		'</s:Body>'
		body +=	'</s:Envelope>\n\r';

	console.log ( '\n' + body + '\n');

	SendCube();

	// Sending SOAP request
	function SendCube () {
		var request = require ('request' );

		request ({
			uri	    : 	'http://' + cfg.Cube_IP + ':49152' + CubeUrl,
			method  : 	'POST',
			headers : {	'Content-length' :   body.length,
						'Content-type'	 :   'text/xml; charset="utf-8"',
						'SOAPACTION'	 :   '"urn:' + CubeUrn + data.CubeAction +'"' },
			body	: 	body

		}, function ( error , response , body ) {

			if ( ! error && response.statusCode == 200 ) {

				var ret = /<executionStatus>(.*?)<\/executionStatus>/gmi.exec( body )[1];
				console.log ( '\nCubeRemote => Commande [OK] : "' + data.CubeAction + '" -> ' + CubeKey + ' : Retour = ' + ret );
				console.log ( '\n' + body );
				
				if (data.CubeAction == 'RegisterSmartPhone' ) cfg.Linked = 'OK';
				callback ({ 'tts': data.ttsAction });
			} else {
				
				console.log ( '\nCubeRemote => Commande [ERREUR] :  Code retour = ' + error + '\n' );
				callback ({ 'tts': "L'action a échouée" });
			}
		});
	}
}
