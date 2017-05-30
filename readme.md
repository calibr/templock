## Install

`npm i templock`

## Use Case

The main use case of this lib is to limit an amount of authorization attempts to some resource, simply said, to prevent credentials brute forcing. For example, if you have authorization form and want to prevent brute forcing on it, it will be a good idea to use this lib.

## Basic information

The lib operates with two basic objects:
- Item ID
- Lock Category

Item ID - it is a string representation of the item that a user wants to access. For a web site authorization form it can be just `authform`.

Lock Category - also a custom string, that describes the user who tries to access an item. For authorization forms, it can be user's IP: `user_ip:125.12.52.51`.

Each lock category should have its strategy - set of rules that describe when and how long an item should be locked for the category. Multiple categories can have the same strategy.

## Usage

Suppose you have a login form and you want to limit login attempts for each user IP to 20 per 5 minutes. Let's write a strategy for this:

```js
var ipStrategy = {
  category: /^ip_.+?/,
  attempts: 20,
  lockFor: 300
}
```

`category` - it is a regular expression or a string that used to match specific strategies
`attempts` - amount of unsuccessful attempts before an item is locked for the strategy
`lockFor` - amount of time in seconds to lock an item for

Then we should create a new TempLock item and add the strategy to it:

```js
var TempLock = require('templock')

var tempLock = new TempLock({
  strategies: [ipStrategy]
})
```

Initialization completed, then if someone logins unsuccessfully in our form we need to log their attempt and also check if the IP is locked:

```

tempLock.isLocked('authform', 'ip_' + remoteAddr).then(locked => {
  if(locked) {
    throw new AuthError('Too Many Attempts')
  }
  if(!login(email, password)) {
    tempLock.addAttempt('authform', 'ip_' + remoteAddr);
  }
})
```

Where `remoteAddr` is IP of the user who tries to log in.
If the user has attempted to log in more than 20 times, we run into the first IF clause and throw an error. That was the simplest usage of the lib.

#### main category

There is the category called "main" which always exist and attempts to it added transparently each time you call `addAttempt`. Basically, this category is used to limit access to the entire item from any categories. For example, if some user has exceeded attempts limit by the main strategy, every user become locked for the resource by the main strategy.

### Storage

The lib can store attempts information either in memory on in Redis, to setup memory database usage consider this code:

```js
tempLock.setStorage(new TempLock.MemoryStorage());
```

*Use memory storage carefully, because after node app restart all attempts data will be lost*

And setup for the Redis storage:

```js
tempLock.setStorage(new TempLock.RedisStorage({
  host: 'localhost',
  port: 6379,
}));
```

The config object passed into the RedisStorage constructor is equivalent to [redis client options](https://github.com/NodeRedis/node_redis#options-object-properties)

### Reference


#### TempLock(config)

`config` is an object containing only one property `strategies` which is an array of strategies, each strategy represents the following object:

```json
{
  category: string | RegExp
  attempts: number,
  lockFor: number
}
```

#### setStorage(storage)

Sets storage for further use, available storages:

- MemoryStorage
- RedisStorage

#### addAttempt(itemId, categories)

Adds attempt for a specific item and category or an array of categories. If categories are omitted attempt will be added to the "main" category.

#### isLocked(itemId, categories)

Check whether an item is locked for specific categories or not. Returns a Promise. If the item is locked for at least one category, a Promise will be resolved with the `true` value.