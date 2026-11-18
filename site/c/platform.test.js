const {detectPlatform:d}=require('./platform.js');
const a=require('assert');
a.equal(d('Mozilla/5.0 (Linux; Android 14; SM-S911N)',5),'android');
a.equal(d('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',5),'ios');
a.equal(d('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)',5),'ios');
a.equal(d('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605',5),'ios');
a.equal(d('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605',0),'desktop');
a.equal(d('Mozilla/5.0 (Windows NT 10.0; Win64; x64)',0),'desktop');
a.equal(d(undefined),'desktop');console.log('unit ok');
