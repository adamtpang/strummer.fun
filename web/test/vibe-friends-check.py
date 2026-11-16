import json
import time

BASE = 'http://127.0.0.1:4392/vibe/'
OUT = 'C:/Users/adamp/.codex/visualizations/2026/07/07/019f3b66-54df-7e23-af8b-c83e9d61ef2e/'

def wait_for(expression):
    for _ in range(150):
        if js(expression):
            return
        time.sleep(.1)
    raise AssertionError(expression)

def click_named(role, name):
    nodes = cdp('Accessibility.getFullAXTree')['nodes']
    node = next(item for item in nodes if item.get('role', {}).get('value') == role and item.get('name', {}).get('value') == name)
    backend = node['backendDOMNodeId']
    cdp('DOM.scrollIntoViewIfNeeded', backendNodeId=backend)
    quad = cdp('DOM.getBoxModel', backendNodeId=backend)['model']['content']
    click_at_xy(sum(quad[0::2]) / 4, sum(quad[1::2]) / 4)

new_tab(BASE)
wait_for_load()
cdp('Page.bringToFront')
cdp('Page.addScriptToEvaluateOnNewDocument', source="""
(() => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user_data');
  if (location.search.includes('signed-in')) {
    localStorage.setItem('access_token','fixture-token');
    localStorage.setItem('user_data',JSON.stringify({id:'recipient',display_name:'Test listener'}));
  }
  window.testWrites = [];
  Object.defineProperty(navigator, 'clipboard', {value:{writeText: async text => {
    if(window.failClipboard) throw new Error('Blocked');
    window.copiedLink = text;
  }}});
  const profile = id => ({spotify_id:id,display_name:id==='sender'?'A music friend':'Test listener',
    avatar_url:'/vibe/icon-192.png',playlist_id:id==='sender'?'0123456789abcdefghijkl':null,vibe_label:'A little soul, a little sunshine',
    vibe_gradient:'linear-gradient(135deg,#307568,#83ac91)',
    average_features:id==='incomplete'?{mainstream:.5,modernity:.6}:{mainstream:.5,modernity:.6,diversity:.7,recencyShift:.4,eraSpread:.5,artistConcentration:.3},
    top_tracks:[{name:'Kids',artist:'MGMT',albumArt:'/vibe/icon-192.png',uri:'spotify:track:0123456789abcdefghijkl'},{name:'Everything Stays',artist:'Rebecca Sugar',albumArt:'/vibe/icon-192.png'},...Array.from({length:6},(_,i)=>({name:'Test song '+i,artist:'Fixture artist',albumArt:'/vibe/icon-192.png'}))],
    top_genres:['soul','indie'],top_artists:[],is_public:id!=='private' && (id!=='recipient'||sessionStorage.getItem('fixture-published')==='yes')});
  const originalFetch=window.fetch;
  window.fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input.url,location.origin);
    if(url.hostname==='accounts.spotify.com') return Response.json({access_token:'fixture-token',expires_in:3600});
    if(url.hostname==='api.spotify.com') {
      if(url.pathname==='/v1/me') return Response.json({id:'recipient',display_name:'Test listener',images:[]});
      throw new Error('No real Spotify requests permitted in test');
    }
    if(url.origin!==location.origin || !url.pathname.startsWith('/api/')) return originalFetch(input,init);
    const id=url.pathname.split('/').pop();
    if(init?.method==='PATCH') {
      window.testWrites.push(JSON.parse(init.body));
      if(window.failPublish) return Response.json({error:'Fixture failure'},{status:500});
      sessionStorage.setItem('fixture-published','yes');
      return Response.json({success:true});
    }
    if(init?.method && init.method!=='GET') throw new Error('Unexpected mutation');
    if(url.pathname==='/api/users') return Response.json({users:[],total:0,topLabels:[]});
    if(id==='missing') return new Response('',{status:404});
    if(id==='recipient') localStorage.removeItem('access_token');
    return Response.json(profile(id));
  };
})();
""")
js("sessionStorage.removeItem('strummer-vibe-invitation');sessionStorage.removeItem('fixture-published')")
goto_url(BASE+'sender')
wait_for_load()
wait_for("document.body.innerText.includes('Compare our music')")
assert js("!document.querySelector('iframe')")
assert js("!document.querySelector('a[href*=\"spotify.com/playlist/\"]')")
goto_url(BASE+'invite/sender')
wait_for_load()
wait_for("document.body.innerText.includes('A music friend wants to hear your world.')")
for width,height in [(1440,1000),(390,844),(320,740)]:
    cdp('Emulation.setDeviceMetricsOverride',width=width,height=height,deviceScaleFactor=1,mobile=width<500)
    assert js('document.documentElement.scrollWidth <= innerWidth')
    capture_screenshot(OUT+'vibe-friend-invite-'+str(width)+'.png')
assert js('window.testWrites.length') == 0
click_named('link','Check our vibes')
wait_for("document.body.innerText.includes('Connect Spotify to compare')")
assert js('location.search') == '?from=sender'

goto_url(BASE+'?from=sender&signed-in=1')
wait_for_load()
wait_for("document.body.innerText.includes('Your invitation')")
assert js("JSON.parse(sessionStorage.getItem('strummer-vibe-invitation')).id") == 'sender'
assert js('window.testWrites.length') == 0
assert js("!document.body.innerText.includes('Copy friend invitation')")
click_named('button','Show all 8 songs')
wait_for("document.body.innerText.includes('Test song 5')")
assert js("document.querySelector('a[aria-label=\"Listen to Kids on Spotify\"]').href") == 'https://open.spotify.com/track/0123456789abcdefghijkl'
click_named('button','Show fewer songs')
assert js("!document.body.innerText.includes('Test song 5')")
click_named('link','Compare with your friend')
wait_for("document.body.innerText.includes('This comparison is private')")
assert js("!document.body.innerText.includes('Copy comparison link')")

js("localStorage.setItem('code_verifier','fixture-verifier');localStorage.setItem('oauth_state','fixture-state');localStorage.setItem('oauth_started_at',String(Date.now()))")
goto_url(BASE+'?code=fixture-code&state=fixture-state')
wait_for_load()
wait_for("document.body.innerText.includes('Your invitation')")
assert js('location.pathname') == '/vibe/recipient'
assert js("JSON.parse(sessionStorage.getItem('strummer-vibe-invitation')).id") == 'sender'
assert js('window.testWrites.length') == 0
js("localStorage.setItem('access_token','fixture-token');window.failPublish=true")
click_named('button','Publish my vibe')
wait_for("document.body.innerText.includes('Your profile was not published')")
assert js("!document.body.innerText.includes('Copy friend invitation')")
js('window.failPublish=false')
click_named('button','Publish my vibe')
wait_for("document.body.innerText.includes('Copy friend invitation')")
click_named('button','Copy friend invitation')
wait_for("document.body.innerText.includes('Link copied')")
assert js('window.copiedLink') == BASE+'invite/recipient'
js('window.failClipboard=true')
click_named('button','Copy friend invitation')
wait_for("!!document.querySelector('.friend-copy-fallback input')")
assert js("document.querySelector('.friend-copy-fallback input').value") == BASE+'invite/recipient'
assert js('window.testWrites.length') == 2
click_named('link','Open comparison to share back')
wait_for("document.body.innerText.includes('Copy comparison link')")
js('window.failClipboard=false')
click_named('button','Copy comparison link')
wait_for("document.body.innerText.includes('Link copied')")
assert js('window.copiedLink') == BASE+'compare/sender/recipient'
assert js("document.body.innerText.toLowerCase().includes('music taste match')")
for width,height in [(1440,1000),(390,844),(320,740)]:
    cdp('Emulation.setDeviceMetricsOverride',width=width,height=height,deviceScaleFactor=1,mobile=width<500)
    assert js('document.documentElement.scrollWidth <= innerWidth')
    capture_screenshot(OUT+'vibe-friend-compare-'+str(width)+'.png')

for route,copy in [('invite/private','This invitation is unavailable'),('invite/missing','This invitation is unavailable'),('compare/sender/incomplete','Not enough listening data')]:
    goto_url(BASE+route)
    wait_for_load()
    wait_for('document.body.innerText.includes('+json.dumps(copy)+')')
    assert js("!document.body.innerText.includes('NaN')")
    if route.startswith('invite/'):
        assert js("!document.body.innerText.includes('Kids')")

goto_url(BASE+'invite/sender')
wait_for_load()
wait_for("document.body.innerText.includes('A music friend wants')")
press_key('Tab')
assert js("getComputedStyle(document.activeElement).outlineStyle") != 'none'
print(json.dumps({'result':'PASS','checks':['invitation preview','mobile and desktop overflow','signed-in invitation retention','mocked OAuth round trip retains inviter','private comparison cannot be shared','no automatic publishing','publish failure and explicit consent','clipboard success and fallback','return comparison link','missing/private invitation','incomplete metrics','keyboard focus']}))
