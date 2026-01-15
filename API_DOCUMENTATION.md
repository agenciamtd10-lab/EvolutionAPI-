# Evolution API Documentation

## Base URL

`{{baseUrl}}`

## Authentication

Global API Key protection is applied to these endpoints. You must provide the API Key in the `apikey` header or query parameter depending on configuration.

> [!IMPORTANT]
> **Instance Parameter**: In all endpoints where `:instance` is used (e.g., `/message/sendText/:instance`), you must provide the **Instance Name**, NOT the Instance ID or Token. If your instance name contains spaces, ensure they are URL encoded (e.g., `My Instance` -> `My%20Instance`).

## Instance APIs

### Create Instance

**POST** `/instance/create`
Creates a new WhatsApp instance.

**Request Body:**

```json
{
  "instanceName": "my-instance",
  "token": "random-token", // optional
  "number": "919876543210", // optional
  "integration": "WHATSAPP-BAILEYS",
  "qrcode": true // fetch qrcode immediately
}
```

### Restart Instance

**POST** `/instance/restart/:instance`
Restarts the specified instance.

### Connect to WhatsApp

**GET** `/instance/connect/:instance`
Initiates connection for the instance (generates QR code if not connected).

### Connection State

**GET** `/instance/connectionState/:instance`
Returns the current connection state of the instance.

### Fetch Instances

**GET** `/instance/fetchInstances`
Returns a list of all instances and their status.
> [!TIP]
> Use this endpoint to find your **Instance Name** (`name` field in the response) if you have forgotten it. You will need this name for all other endpoints.

### Set Presence

**POST** `/instance/setPresence/:instance`
Sets the presence status (online, unavailable, etc.).

**Request Body:**

```json
{
  "presence": "available" // available, unavailable, composed, recording, paused
}
```

### Logout Instance

**DELETE** `/instance/logout/:instance`
Logs out the instance from WhatsApp.

### Delete Instance

**DELETE** `/instance/delete/:instance`
Deletes the instance from the server.

---

## Message APIs

All message endpoints expect the instance name in the URL params or query.
Base Path: `/message`

### Send Text

**POST** `/message/sendText/:instance`

**Request Body:**

```json
{
  "number": "919876543210",
  "text": "Hello World",
  "delay": 1200,
  "linkPreview": true
}
```

### Send Media

**POST** `/message/sendMedia/:instance`
Send images, videos, or documents. Can accept a file upload or a URL/Base64 in the body.

**Request Body:**

```json
{
  "number": "919876543210",
  "mediatype": "image", // image, video, document
  "media": "https://example.com/image.png", // or base64
  "caption": "Check this out!"
}
```

### Send Audio

**POST** `/message/sendWhatsAppAudio/:instance`
Send an audio message (push-to-talk style).

**Request Body:**

```json
{
  "number": "919876543210",
  "audio": "https://example.com/audio.mp3"
}
```

### Send Sticker

**POST** `/message/sendSticker/:instance`

**Request Body:**

```json
{
  "number": "919876543210",
  "sticker": "https://example.com/sticker.webp"
}
```

### Send Location

**POST** `/message/sendLocation/:instance`

**Request Body:**

```json
{
  "number": "919876543210",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "name": "San Francisco",
  "address": "California, USA"
}
```

### Send Contact

**POST** `/message/sendContact/:instance`

**Request Body:**

```json
{
  "number": "919876543210",
  "contact": [
    {
      "fullName": "John Doe",
      "phoneNumber": "919876543210"
    }
  ]
}
```

### Send Reaction

**POST** `/message/sendReaction/:instance`

**Request Body:**

```json
{
  "key": {
    "remoteJid": "5511999999999@s.whatsapp.net",
    "fromMe": true,
    "id": "MESSAGE_ID"
  },
  "reaction": "👍"
}
```

### Send Poll

**POST** `/message/sendPoll/:instance`

**Request Body:**

```json
{
  "number": "919876543210",
  "name": "Poll Title",
  "selectableCount": 1,
  "values": ["Option 1", "Option 2"]
}
```

### Send Template

**POST** `/message/sendTemplate/:instance`

**Request Body:**

```json
{
  "number": "919876543210",
  "name": "template_name",
  "language": "en",
  "components": []
}
```

---

## Call APIs

### Offer Call

**POST** `/call/offer/:instance`
Initiates a call offer.

**Request Body:**

```json
{
  "number": "919876543210",
  "isVideo": false,
  "callDuration": 1000
}
```

---

## Chat APIs

Base Path: `/chat`

### Check WhatsApp Number

**POST** `/chat/whatsappNumbers/:instance`
Checks if a number exists on WhatsApp.

**Request Body:**

```json
{
  "numbers": ["5511999999999"]
}
```

### Mark Message as Read

**POST** `/chat/markMessageAsRead/:instance`

**Request Body:**

```json
{
  "readMessages": [
    {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "MESSAGE_ID"
    }
  ]
}
```

### Archive Chat

**POST** `/chat/archiveChat/:instance`

**Request Body:**

```json
{
  "lastMessage": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net"
    }
  },
  "archive": true
}
```

### Fetch Profile Picture

**POST** `/chat/fetchProfilePictureUrl/:instance`

**Request Body:**

```json
{
  "number": "919876543210"
}
```

### Update Profile Picture

**POST** `/chat/updateProfilePicture/:instance`

**Request Body:**

```json
{
  "picture": "https://example.com/image.png" // or base64
}
```

### Fetch Contacts

**POST** `/chat/findContacts/:instance`

**Request Body:**

```json
{
  "where": {}
}
```

### Block User

**POST** `/chat/updateBlockStatus/:instance`

**Request Body:**

```json
{
  "number": "919876543210",
  "status": "block" // block or unblock
}
```

---

## Group APIs

Base Path: `/group`

### Create Group

**POST** `/group/create/:instance`

**Request Body:**

```json
{
  "subject": "Group Name",
  "participants": ["5511999999999", "919876543210"],
  "description": "Group Description"
}
```

### Update Group Subject

**POST** `/group/updateGroupSubject/:instance`

**Request Body:**

```json
{
  "groupJid": "123456789@g.us",
  "subject": "New Subject"
}
```

### Fetch All Groups

**GET** `/group/fetchAllGroups/:instance`
Query Params: `getParticipants=true` (optional)

### Find Group Info

**GET** `/group/findGroupInfos/:instance?groupJid=123456789@g.us`

### Update Participants

**POST** `/group/updateParticipant/:instance`

**Request Body:**

```json
{
  "groupJid": "123456789@g.us",
  "action": "add", // add, remove, promote, demote
  "participants": ["5511999999999"]
}
```

### Get Invite Code

**GET** `/group/inviteCode/:instance?groupJid=123456789@g.us`

### Send Invite

**POST** `/group/sendInvite/:instance`

**Request Body:**

```json
{
  "groupJid": "123456789@g.us",
  "description": "Join my group!",
  "numbers": ["5511999999999"]
}
```

### Leave Group

**DELETE** `/group/leaveGroup/:instance`

**Request Body:**

```json
{
  "groupJid": "123456789@g.us"
}
```

---

## Business APIs

Base Path: `/business`

### Get Catalog

**POST** `/business/getCatalog/:instance`

**Request Body:**

```json
{
  "number": "919876543210",
  "limit": 10
}
```

---

## Template APIs

Base Path: `/template`

### Create Template

**POST** `/template/create/:instance`

**Request Body:**

```json
{
  "name": "template_name",
  "category": "UTILITY", // AUTHENTICATION, MARKETING, UTILITY
  "allowCategoryChange": true,
  "language": "en",
  "components": []
}
```

### Edit Template

**POST** `/template/edit/:instance`

**Request Body:**

```json
{
  "templateId": "123",
  "category": "MARKETING"
}
```

### Delete Template

**DELETE** `/template/delete/:instance`

**Request Body:**

```json
{
  "name": "template_name"
}
```

### Find Templates

**GET** `/template/find/:instance`

---

## Settings APIs

Base Path: `/settings`

### Set Settings

**POST** `/settings/set/:instance`

**Request Body:**

```json
{
  "rejectCall": false,
  "groupsIgnore": false,
  "alwaysOnline": true,
  "readMessages": true,
  "readStatus": false
}
```

### Find Settings

**GET** `/settings/find/:instance`

---

## Proxy APIs

Base Path: `/proxy`

### Set Proxy

**POST** `/proxy/set/:instance`

**Request Body:**

```json
{
  "enabled": true,
  "host": "127.0.0.1",
  "port": "8080",
  "protocol": "http",
  "username": "user",
  "password": "pass"
}
```

### Find Proxy

**GET** `/proxy/find/:instance`

---

## Label APIs

Base Path: `/label`

### Find Labels

**GET** `/label/findLabels/:instance`

### Handle Label (Add/Remove)

**POST** `/label/handleLabel/:instance`

**Request Body:**

```json
{
  "number": "919876543210",
  "labelId": "123",
  "action": "add" // add, remove
}
```

---

## Integration APIs

### Webhook

Base Path: `/webhook`

#### Set Webhook

**POST** `/webhook/set/:instance`

**Request Body:**

```json
{
  "enabled": true,
  "url": "https://myserver.com/webhook",
  "webhookByEvents": false,
  "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE"]
}
```

#### Find Webhook

**GET** `/webhook/find/:instance`

### OpenAI

Base Path: `/openai`

#### Create Bot

**POST** `/openai/create/:instance`

**Request Body:**

```json
{
  "name": "MyBot",
  "model": "gpt-3.5-turbo",
  "systemMessages": ["You are a helpful assistant"]
}
```

### Other Integrations

The following integrations are available and broadly follow the `set` / `find` pattern or specific creation flows similar to the above.

#### Chatbots

- **EvolutionBot**: `/evolutionBot`
- **Chatwoot**: `/chatwoot`
- **Typebot**: `/typebot`
- **Dify**: `/dify`
- **Flowise**: `/flowise`
- **N8N**: `/n8n`
- **EvoAI**: `/evoai`

#### Events

- **RabbitMQ**: `/rabbitmq`
- **SQS**: `/sqs`
- **WebSocket**: `/websocket`
- **Pusher**: `/pusher`
- **Kafka**: `/kafka`

```

```

```
