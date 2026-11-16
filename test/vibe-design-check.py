import json
import time

BASE = 'http://127.0.0.1:4392/vibe/'
OUT = 'C:/Users/adamp/.codex/visualizations/2026/07/07/019f3b66-54df-7e23-af8b-c83e9d61ef2e/'

def wait_for(expression):
    for _ in range(150):
        if js(expression):
            return
        time.sleep(0.1)
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
  if (location.pathname.endsWith('/test-owner')) {
    localStorage.setItem('user_data', JSON.stringify({id:'test-owner', display_name:'Test listener'}));
    localStorage.setItem('access_token', 'local-fixture-only');
  }
  const profile = id => ({
    spotify_id:id, display_name:id === 'test-owner' ? 'Test listener' : 'Sample listener',
    avatar_url:'/vibe/icon-192.png', playlist_id:null,
    vibe_label:'A little soul, a little sunshine',
    vibe_gradient:'linear-gradient(135deg, #307568, #83ac91)',
    average_features:{mainstream:0.5,modernity:0.6,diversity:0.7,recencyShift:0.4,eraSpread:0.5,artistConcentration:0.3,avgYear:2015,uniqueGenres:3,avgPopularity:50,topGenreShare:0.5},
    top_tracks:[['Kids','MGMT'],['Everything Stays','Rebecca Sugar'],["Don\'t Look Back in Anger",'Oasis']].map(([name,artist],i)=>({id:String(i),name,artist,albumArt:'/vibe/icon-192.png',url:'https://open.spotify.com/'})),
    top_genres:['psychedelic pop','soul','indie'],
    top_artists:[{id:'sample',name:'Sample artist',image:'/vibe/icon-192.png',genres:['soul'],popularity:50,url:'https://open.spotify.com/'}],
    is_public:id !== 'test-owner' && id !== 'private', updated_at:new Date().toISOString()
  });
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
    if(url.origin !== location.origin || !url.pathname.startsWith('/api/')) return originalFetch(input,init);
    if(init?.method && init.method !== 'GET') throw new Error('Test prevents API mutations');
    if(url.pathname === '/api/users') return Response.json({users:[profile('sample-a'),profile('sample-b'),profile('sample-c')],total:3,topLabels:[]});
    const id = url.pathname.split('/').pop();
    if(id === 'test-owner') localStorage.removeItem('access_token');
    if(id === 'missing') return new Response('', {status:404});
    return Response.json(profile(id));
  };
})();
""")

results = []
routes = [('', 'vibecheck.'), ('explore', 'Explore vibes'), ('sample-a', 'Sample listener'), ('test-owner', 'Test listener'), ('compare/sample-a/sample-b', 'Compare vibes'), ('privacy', 'Privacy Policy'), ('terms', 'Terms of Service'), ('private', 'private vibe'), ('card/make.html', 'Make a playlist card')]
for route, heading in routes:
    goto_url(BASE + route)
    wait_for_load()
    wait_for('!!document.querySelector("h1") && document.querySelector("h1").textContent === ' + json.dumps(heading))
    for width, height in [(1440,1000),(390,844),(320,740)]:
        cdp('Emulation.setDeviceMetricsOverride', width=width,height=height,deviceScaleFactor=1,mobile=width < 500)
        time.sleep(.3)
        assert js('document.documentElement.scrollWidth <= innerWidth'), (route,width,'page overflow')
        assert js("getComputedStyle(document.body).backgroundColor") == 'rgb(17, 18, 19)', (route, 'background')
        assert js("document.querySelectorAll('header').length") == 1, (route, 'shared header')
        assert js("document.querySelectorAll('footer').length") == 1, (route, 'shared footer')
        assert js("document.querySelectorAll('main').length") == 1, (route, 'main landmark')
        assert js("Array.from(document.images).every(image => image.complete && image.naturalWidth > 0)"), (route, 'images')
        assert js("!document.body.innerText.includes('NaN')"), (route, 'numeric content')
        assert js("Array.from(document.querySelectorAll('button')).every(b => b.textContent.trim() || b.getAttribute('aria-label'))"), (route, 'button names')
        if width in [1440,390]:
            capture_screenshot(OUT + 'vibe-design-' + (route.replace('/','-') or 'home') + '-' + str(width) + '.png')
    results.append(route or 'home')

goto_url(BASE)
wait_for_load()
wait_for("!!document.querySelector('h1')")
click_named('link', 'Explore')
wait_for("document.querySelector('h1')?.textContent === 'Explore vibes'")
assert js("document.activeElement.id") == 'vibe-content'
assert js("document.querySelector('.vibe-nav a[aria-current=page]').textContent") == 'Explore'
press_key('Tab')
assert js("getComputedStyle(document.activeElement).outlineStyle") != 'none'

goto_url(BASE + 'test-owner')
wait_for_load()
wait_for("document.body.innerText.includes('Make an Instagram Story')")
click_named('button', 'Make an Instagram Story')
wait_for("!!document.querySelector('[role=dialog] img')")
assert js("document.querySelector('[role=dialog]').scrollWidth <= document.querySelector('[role=dialog]').clientWidth")
press_key('Escape')
assert js("document.activeElement.textContent.trim()") == 'Make an Instagram Story'

cdp('Emulation.setEmulatedMedia', features=[{'name':'prefers-reduced-motion','value':'reduce'},{'name':'prefers-reduced-transparency','value':'reduce'}])
goto_url(BASE + 'explore')
wait_for_load()
wait_for("document.querySelector('h1')?.textContent === 'Explore vibes'")
assert js("getComputedStyle(document.querySelector('.vibe-header')).backdropFilter") == 'none'
assert js("matchMedia('(prefers-reduced-motion: reduce)').matches")
cdp('Emulation.setEmulatedMedia', features=[])
print(json.dumps({'result':'PASS','routes':results,'viewports':[1440,390,320],'checks':['consistent shell and colors','single main and footer','no page overflow','named controls','route focus and active navigation','profile story launch and focus return','reduced transparency and motion preferences']}))
