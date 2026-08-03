# Changelog

## [1.4.1](https://github.com/geekitycom/ytopml/compare/v1.4.0...v1.4.1) (2026-08-03)


### Bug Fixes

* add a node shebang to build-docker.js ([f6d7efb](https://github.com/geekitycom/ytopml/commit/f6d7efb90aa07697a15e2cb9778b511dd9bab669))
* force a consent screen so added scopes are actually granted ([ba50a40](https://github.com/geekitycom/ytopml/commit/ba50a4046ce81754b57b0df71092b5433eedfc10))
* listen on the configured PORT ([8258a51](https://github.com/geekitycom/ytopml/commit/8258a51907dfcb539095bbf51832ceca54984b39))
* log when a channel sync falls back to stored data ([dd75c85](https://github.com/geekitycom/ytopml/commit/dd75c851fcdb62ee4c4255a4aa29a22d5781256f))
* require a signed in user to delete an account ([fdef8d5](https://github.com/geekitycom/ytopml/commit/fdef8d51ae85290aad78fb7fa3894b83238bc264))
* stop a failed merge from erasing stored channels ([c9ca0d3](https://github.com/geekitycom/ytopml/commit/c9ca0d30c41fe6be6e317068d224b04bbceb5ea5))

## [1.4.0](https://github.com/geekitycom/ytopml/compare/v1.3.0...v1.4.0) (2026-08-03)


### Features

* advertise and ping an rssCloud server for OPML changes ([a38f979](https://github.com/geekitycom/ytopml/commit/a38f979f7c7b9818482d2bc26db6ba0e81293e9a))
* replace better-sqlite3 and dotenv with Node 24 built-ins ([2f7aad0](https://github.com/geekitycom/ytopml/commit/2f7aad0845804210961c91ac2e2bb6225d856c2f))


### Bug Fixes

* close the bracket on the author email ([18fefc3](https://github.com/geekitycom/ytopml/commit/18fefc396a00e687b52734cbcb3a7db1d220c5cf))
* point package metadata at the current repository location ([2b43e81](https://github.com/geekitycom/ytopml/commit/2b43e81f57e26415de15e7ae69a6398c86459e04))
* refresh channel metadata so renames reach the OPML ([a6526e1](https://github.com/geekitycom/ytopml/commit/a6526e1c1a5d1fd30b042f76de4a8fb02bcc498d))
* treat an unreadable ping response as a failure ([a0b24c4](https://github.com/geekitycom/ytopml/commit/a0b24c401690472725ecbe8def8ccaa1db79d252))
