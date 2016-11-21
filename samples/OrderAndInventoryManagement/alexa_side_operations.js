'use strict';

/**
 * This sample demonstrates a simple skill built with the Amazon Alexa Skills Kit.
 * The Intent Schema, Custom Slots, and Sample Utterances for this skill, as well as
 * testing instructions are located at http://amzn.to/1LzFrj6
 *
 * For additional samples, visit the Alexa Skills Kit Getting Started guide at
 * http://amzn.to/1LGWsLG
 */

const AWS = require('aws-sdk');
const KINTONE_FUNCTION = 'rentItems';

var lambda = new AWS.Lambda({
  apiVersion: '2015-03-31'
});
// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
  return {
    outputSpeech: {
      type: 'PlainText',
      text: output,
    },
    card: {
      type: 'Simple',
      title: `SessionSpeechlet - ${title}`,
      content: `SessionSpeechlet - ${output}`,
    },
    reprompt: {
      outputSpeech: {
        type: 'PlainText',
        text: repromptText,
      },
    },
    shouldEndSession,
  };
}

function buildResponse(sessionAttributes, speechletResponse) {
  return {
    version: '1.0',
    sessionAttributes,
    response: speechletResponse,
  };
}


// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
  // If we wanted to initialize the session to have some attributes we could add those here.
  const sessionAttributes = {};
  const cardTitle = 'Welcome';
  const speechOutput = "Please order the type of rental bike";
  // If the user either does not reply to the welcome message or says something that is not
  // understood, they will be prompted again with this text.
  const repromptText = "Please order the type of rental bike";
  const shouldEndSession = false;

  callback(sessionAttributes,
    buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function handleSessionEndRequest(callback) {
  const cardTitle = 'Session Ended';
  const speechOutput = "Thank you for your order";
  // Setting this to true ends the session and exits the skill.
  const shouldEndSession = true;

  callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}

function createFavoriteColorAttributes(favoriteColor) {
  return {
    favoriteColor,
  };
}

/**
 * Sets the color in the session and prepares the speech to reply to the user.
 */
function setColorInSession(intent, session, callback) {
  const cardTitle = intent.name;
  const favoriteColorSlot = intent.slots.Color;
  let repromptText = '';
  let sessionAttributes = {};
  const shouldEndSession = false;
  let speechOutput = '';

  if (favoriteColorSlot) {
    const favoriteColor = favoriteColorSlot.value;
    sessionAttributes = createFavoriteColorAttributes(favoriteColor);
    speechOutput = `I now know your favorite color is ${favoriteColor}. You can ask me ` +
      "your favorite color by saying, what's my favorite color?";
    repromptText = "You can ask me your favorite color by saying, what's my favorite color?";
  } else {
    speechOutput = "I'm not sure what your favorite color is. Please try again.";
    repromptText = "I'm not sure what your favorite color is. You can tell me your " +
      'favorite color by saying, my favorite color is red';
  }

  callback(sessionAttributes,
    buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function getColorFromSession(intent, session, callback) {
  let favoriteColor;
  const repromptText = null;
  const sessionAttributes = {};
  let shouldEndSession = false;
  let speechOutput = '';

  if (session.attributes) {
    favoriteColor = session.attributes.favoriteColor;
  }

  if (favoriteColor) {
    speechOutput = `Your favorite color is ${favoriteColor}. Goodbye.`;
    shouldEndSession = true;
  } else {
    speechOutput = "I'm not sure what your favorite color is, you can say, my favorite color " +
      ' is red';
  }

  // Setting repromptText to null signifies that we do not want to reprompt the user.
  // If the user does not respond or says something that is not understood, the session
  // will end.
  callback(sessionAttributes,
    buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
}


// --------------- Events -----------------------

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
  console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
  console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);

  // Dispatch to your skill's launch.
  getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
  console.log(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}`);

  const intent = intentRequest.intent;
  const intentName = intentRequest.intent.name;

  // Dispatch to your skill's intent handlers
  if ("BikeTypeIntent" === intentName) {
    runRental(intent, session, callback);
  } else if ("AMAZON.HelpIntent" === intentName) {
    getWelcomeResponse(callback);
  } else if ("AMAZON.StopIntent" === intentName || "AMAZON.CancelIntent" === intentName) {
    handleSessionEndRequest(callback);
  } else {
    throw "Invalid intent";
  }
}


function rentItemsInvoke(type, callback, errback) {
  var params = {
    FunctionName: KINTONE_FUNCTION,
    Payload: '{"type": "' + type + '"}'
  };
  lambda.invoke(params, function(err, data) {
    if (err) {
      return errback(err); // an error occurred
    } else {
      return callback(data);
    }
  });
}

function runRental(intent, session, callback) {
  console.log('start "run rental program"');
  var cardTitle = intent.name;
  var orderTypeSlot = intent.slots.Type;
  var repromptText = `Ok, I'll regist kintone records by ${orderTypeSlot.value} type. Goodbye!`;
  var sessionAttributes = {};
  var shouldEndSession = true;
  var speechOutput = `Ok, I'll regist kintone records by ${orderTypeSlot.value} type. Goodbye!`;

  rentItemsInvoke(orderTypeSlot.value, function(r) {
    console.log('kintone all records deletion');
    callback(sessionAttributes,
      buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
  }, function(e) {
    callback(sessionAttributes,
      buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
  });

}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
  console.log(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`);
  // Add cleanup logic here
}


// --------------- Main handler -----------------------

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = (event, context, callback) => {
  try {
    console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);

    /**
     * Uncomment this if statement and populate with your skill's application ID to
     * prevent someone else from configuring a skill that sends requests to this function.
     */
    /*
    if (event.session.application.applicationId !== 'amzn1.echo-sdk-ams.app.[unique-value-here]') {
         callback('Invalid Application ID');
    }
    */

    if (event.session.new) {
      onSessionStarted({
        requestId: event.request.requestId
      }, event.session);
    }

    if (event.request.type === 'LaunchRequest') {
      onLaunch(event.request,
        event.session,
        (sessionAttributes, speechletResponse) => {
          callback(null, buildResponse(sessionAttributes, speechletResponse));
        });
    } else if (event.request.type === 'IntentRequest') {
      onIntent(event.request,
        event.session,
        (sessionAttributes, speechletResponse) => {
          callback(null, buildResponse(sessionAttributes, speechletResponse));
        });
    } else if (event.request.type === 'SessionEndedRequest') {
      onSessionEnded(event.request, event.session);
      callback();
    }
  } catch (err) {
    callback(err);
  }
};
