import test from "node:test";
import assert from "node:assert/strict";
import {enterAction,type EnterKey} from "../lib/composer-keys";

const key=(over:Partial<EnterKey>={}):EnterKey=>({key:"Enter",shiftKey:false,ctrlKey:false,metaKey:false,altKey:false,isComposing:false,...over});

test("composer: Enter sends, Shift+Enter adds a line, Ctrl/Cmd+Enter sends",()=>{
 assert.equal(enterAction(key(),false),"send");
 assert.equal(enterAction(key({shiftKey:true}),false),"newline");
 assert.equal(enterAction(key({altKey:true}),false),"newline");
 assert.equal(enterAction(key({metaKey:true}),false),"send");
 assert.equal(enterAction(key({ctrlKey:true,shiftKey:true}),false),"send");
});

test("composer: Enter belongs to the keyboard while it composes; other keys do nothing; a touch keyboard adds a line",()=>{
 assert.equal(enterAction(key({isComposing:true}),false),null);
 assert.equal(enterAction(key({key:"a"}),false),null);
 assert.equal(enterAction(key(),true),"newline");
 assert.equal(enterAction(key({metaKey:true}),true),"send");
});
