/* Sketch.js - vendor copy shared across sites */
/* Source: https://github.com/soulwire/sketch.js (Justin Windle) */
(function (root, factory) {
  if (typeof exports === 'object') { module.exports = factory(root, root.document); }
  else if (typeof define === 'function' && define.amd) { define(function () { return factory(root, root.document); }); }
  else { root.Sketch = factory(root, root.document); }
})(this, function (window, document) {
  'use strict';
  var M = Math, doc = document, win = window;
  var CANVAS='canvas', WEBGL='webgl', DOM='dom', HAS_SKETCH='__hasSketch';
  var instances=[], defaults={ fullscreen:true, autostart:true, autoclear:true, autopause:true, container:doc.body, interval:1, globals:true, retina:false, type:CANVAS };
  var keyMap={8:'BACKSPACE',9:'TAB',13:'ENTER',16:'SHIFT',27:'ESCAPE',32:'SPACE',37:'LEFT',38:'UP',39:'RIGHT',40:'DOWN'};
  function isArray(o){return Object.prototype.toString.call(o)=='[object Array]';}
  function isFunction(o){return typeof o==='function';}
  function isNumber(o){return typeof o==='number';}
  function isString(o){return typeof o==='string';}
  function keyName(code){return keyMap[code]||String.fromCharCode(code);}
  function extend(t,s,o){for(var k in s){if(o||!(k in t))t[k]=s[k];}return t;}
  function proxy(m,c){return function(){m.apply(c,arguments);};}
  function clone(t){var o={};for(var k in t){o[k]=isFunction(t[k])?proxy(t[k],t):t[k];}return o;}
  function ctor(context){
    var request,handler,target,parent,bounds,index,suffix,clock,node,copy,type,key,val,min,max,w,h;
    var counter=0,touches=[],resized=false,setup=false;var ratio=win.devicePixelRatio||1;var isDiv=context.type==DOM,is2D=context.type==CANVAS;
    var mouse={x:0,y:0,ox:0,oy:0,dx:0,dy:0};
    var eventMap=[context.element, pointer,'mousedown','touchstart', pointer,'mousemove','touchmove', pointer,'mouseup','touchend', pointer,'click', pointer,'mouseout', pointer,'mouseover', doc, keypress,'keydown','keyup', win, active,'focus','blur', resize,'resize'];
    var keys={};for(key in keyMap){keys[keyMap[key]]=false;}
    function trigger(m){if(isFunction(m))m.apply(context,[].splice.call(arguments,1));}
    function bind(on){for(index=0;index<eventMap.length;index++){node=eventMap[index]; if(isString(node)){target[(on?'add':'remove')+'EventListener'].call(target,node,handler,false);} else if(isFunction(node)){handler=node;} else {target=node;}}}
    function update(){cAF(request);request=rAF(update); if(!setup){trigger(context.setup); setup=isFunction(context.setup);} if(!resized){trigger(context.resize); resized=isFunction(context.resize);} if(context.running&&!counter){ context.dt=(clock=+new Date())-context.now; context.millis+=context.dt; context.now=clock; trigger(context.update); if(is2D){ if(context.retina){context.save();context.scale(ratio,ratio);} if(context.autoclear){context.clear();} } trigger(context.draw); if(is2D&&context.retina){context.restore();} } counter=++counter%context.interval;}
    function resize(){ target=isDiv?context.style:context.canvas; suffix=isDiv?'px':''; w=context.width; h=context.height; if(context.fullscreen){h=win.innerHeight; w=win.innerWidth;} if(context.autoresize){h=target.clientHeight; w=target.clientWidth;} if(context.retina&&is2D&&ratio){target.style.height=h+'px'; target.style.width=w+'px'; w*=ratio; h*=ratio;} if(target.height!==h)target.height=h+suffix; if(target.width!==w)target.width=w+suffix; if(setup)trigger(context.resize);}
    function align(t,tgt){bounds=tgt.getBoundingClientRect(); t.x=t.pageX-bounds.left-(win.scrollX||win.pageXOffset); t.y=t.pageY-bounds.top-(win.scrollY||win.pageYOffset); return t;}
    function augment(t,tgt){align(t,context.element); tgt=tgt||{}; tgt.ox=tgt.x||t.x; tgt.oy=tgt.y||t.y; tgt.x=t.x; tgt.y=t.y; tgt.dx=tgt.x-tgt.ox; tgt.dy=tgt.y-tgt.oy; return tgt;}
    function process(e){e.preventDefault(); copy=clone(e); copy.originalEvent=e; if(copy.touches){touches.length=copy.touches.length; for(index=0;index<copy.touches.length;index++){touches[index]=augment(copy.touches[index],touches[index]);}} else {touches.length=0; touches[0]=augment(copy,mouse);} extend(mouse,touches[0],true); return copy;}
    function pointer(e){e=process(e); min=(max=eventMap.indexOf((type=e.type)))-1; context.dragging=/down|start/.test(type)?true:/up|end/.test(type)?false:context.dragging; while(min){ isString(eventMap[min])?trigger(context[eventMap[min--]],e): isString(eventMap[max])?trigger(context[eventMap[max++]],e):(min=0);} }
    function keypress(e){key=e.keyCode; val=e.type=='keyup'; keys[key]=keys[keyName(key)]=!val; trigger(context[e.type],e);}
    function active(e){ if(context.autopause){(e.type=='blur'?stop:start)();} trigger(context[e.type],e);}
    function start(){context.now=+new Date(); context.running=true;} function stop(){context.running=false;} function toggle(){(context.running?stop:start)();} function clear(){if(is2D){context.clearRect(0,0,context.width,context.height);}}
    function destroy(){ parent=context.element.parentNode; index=instances.indexOf(context); if(parent){parent.removeChild(context.element);} if(~index){instances.splice(index,1);} bind(false); stop(); }
    extend(context,{touches:touches,mouse:mouse,keys:keys,dragging:false,running:false,millis:0,now:NaN,dt:NaN,destroy:destroy,toggle:toggle,clear:clear,start:start,stop:stop}); instances.push(context); return (context.autostart&&start(), bind(true), resize(), update(), context);
  }
  var element,context,Sketch={
    CANVAS:CANVAS, WEB_GL:WEBGL, WEBGL:WEBGL, DOM:DOM, instances:instances,
    install:function(context){ if(!context[HAS_SKETCH]){ var P='E LN10 LN2 LOG2E LOG10E PI SQRT1_2 SQRT2 abs acos asin atan ceil cos exp floor log round sin sqrt tan atan2 pow max min'.split(' '); for(var i=0;i<P.length;i++){context[P[i]]=M[P[i]];} extend(context,{ TWO_PI:M.PI*2, HALF_PI:M.PI/2, QUATER_PI:M.PI/4, random:function(min,max){ if(isArray(min))return min[~~(M.random()*min.length)]; if(!isNumber(max)){((max=min||1),(min=0));} return min+M.random()*(max-min); }, lerp:function(min,max,a){return min+a*(max-min);}, map:function(num,minA,maxA,minB,maxB){return ((num-minA)/(maxA-minA))*(maxB-minB)+minB;} }); context[HAS_SKETCH]=true; } },
    create:function(options){ options=extend(options||{},defaults); if(options.globals){Sketch.install(self);} element=options.element=options.element||doc.createElement(options.type===DOM?'div':'canvas'); context=options.context=options.context||(function(){ switch(options.type){ case CANVAS:return element.getContext('2d',options); case WEBGL:return (element.getContext('webgl',options)||element.getContext('experimental-webgl',options)); case DOM:return (element.canvas=element);} })(); (options.container||doc.body).appendChild(element); return Sketch.augment(context,options); },
    augment:function(context,options){ options=extend(options||{},defaults); options.element=context.canvas||context; options.element.className+=' sketch'; extend(context,options,true); return ctor(context); }
  };
  var vendors=['ms','moz','webkit','o'], scope=self, then=0, a='AnimationFrame', b='request'+a, c='cancel'+a; var rAF=scope[b], cAF=scope[c]; for(var i=0;i<vendors.length && !rAF;i++){rAF=scope[vendors[i]+'Request'+a]; cAF=scope[vendors[i]+'Cancel'+a];}
  scope[b]=rAF=rAF||function(cb){ var now=+new Date(), dt=M.max(0,16-(now-then)), id=setTimeout(function(){cb(now+dt);},dt); then=now+dt; return id;};
  scope[c]=cAF=cAF||function(id){clearTimeout(id);};
  return Sketch;
});
