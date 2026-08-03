# YTOPML

YTOPML (YouTube OPML) is a simple tool that will export your YouTube subscriptions to an OPML subscription list.

You'll need a YouTube Data API id & secret.
See https://developers.google.com/youtube/v3/getting-started


## Installation

```bash
npm install
cp .env.example .env
```

## Usage

```bash
npm start
```

## Docker

```bash
docker compose up
```

## rssCloud

Each generated OPML advertises an [rssCloud](https://rpc.rsscloud.io/docs) server in
its head using the [`source` namespace](https://source.scripting.com/):

```xml
<opml version="1.0" xmlns:source="https://source.scripting.com/">
  <head>
    <title>YouTube Subscriptions</title>
    <source:cloud>https://rpc.rsscloud.io/pleaseNotify</source:cloud>
  </head>
```

Readers register with that server to be told the moment a list changes instead of
polling for it. YTOPML pings the server whenever a change alters the published
OPML — selecting or deselecting a channel, a renamed channel, or a deleted account.
Discovering a new subscription does not ping, since new channels start unselected
and so do not appear in the file.

Configure with `RSSCLOUD_ENABLED` and `RSSCLOUD_SERVER`. Pinging is automatically
disabled when `OIDC_ISSUER_BASE_URL` is localhost, because the cloud server has to
be able to fetch the OPML to notify anyone.

## License

YTOPML is licensed under the GPL-3.0 license. See the [LICENSE](LICENSE) file for more details.
