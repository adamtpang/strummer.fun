import json
import time

OUT = 'C:/Users/adamp/.codex/visualizations/2026/07/07/019f3b66-54df-7e23-af8b-c83e9d61ef2e/'
BASE = 'http://127.0.0.1:4392/vibe/'

def wait_for(expression):
    for _ in range(100):
        if js(expression):
            return
        time.sleep(0.1)
    raise AssertionError(expression)

def click_button(name):
    nodes = cdp('Accessibility.getFullAXTree')['nodes']
    target = next(node for node in nodes if node.get('role', {}).get('value') in ['button', 'tab']
                  and node.get('name', {}).get('value') == name)
    backend = target['backendDOMNodeId']
    cdp('DOM.scrollIntoViewIfNeeded', backendNodeId=backend)
    points = cdp('DOM.getBoxModel', backendNodeId=backend)['model']['content']
    click_at_xy(sum(points[0::2]) / 4, sum(points[1::2]) / 4)

def ready_image():
    wait_for("!!document.querySelector('img') && !Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Share Story')?.disabled")

def image_pixel():
    return js("""(async()=>{
      const image = document.querySelector('img'); await image.decode();
      const canvas = document.createElement('canvas'); canvas.width=1080;canvas.height=1920;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);
      return Array.from(context.getImageData(500,900,1,1).data);
    })()""")

def check_pixel(expected):
    actual = image_pixel()[:3]
    assert all(abs(value - reference) <= 5 for value, reference in zip(actual, expected)), actual

new_tab(BASE)
wait_for_load()
cdp('Page.bringToFront')
wait_for("!!document.querySelector('h1')")
assert js("document.querySelector('h1').textContent") == 'vibecheck.'
js("localStorage.setItem('strummer-vibe-story-layout','spotlight');localStorage.setItem('strummer-vibe-story-theme','vibe');localStorage.setItem('user_data','{broken');localStorage.setItem('access_token','old');localStorage.setItem('strummer.songbook.v1','keep');location.reload()")
wait_for_load()
wait_for("!!document.querySelector('h1')")
assert js("localStorage.getItem('strummer.songbook.v1')") == 'keep'
assert js("localStorage.getItem('access_token')") is None
press_key('Tab')
assert js("getComputedStyle(document.activeElement).outlineStyle") != 'none'
for width, height in [(1440, 900), (390, 844), (320, 740)]:
    cdp('Emulation.setDeviceMetricsOverride', width=width, height=height, deviceScaleFactor=1, mobile=width < 500)
    time.sleep(0.3)
    assert js('document.documentElement.scrollWidth <= innerWidth')
    if width == 390:
        capture_screenshot(OUT + 'vibe-home-mobile.png')
    if width == 1440:
        capture_screenshot(OUT + 'vibe-home-desktop.png')

new_tab(BASE + 'test/story-harness.html')
wait_for_load()
cdp('Page.bringToFront')
cdp('Emulation.setDeviceMetricsOverride', width=1440, height=900, deviceScaleFactor=1, mobile=False)
wait_for("!!document.querySelector('button')")
click_button('Open test story')
ready_image()
check_pixel([238, 17, 51])
click_button('2 Second test song Another test artist')
ready_image()
check_pixel([17, 102, 238])
click_button('Share Story')
wait_for('window.vibeTest.shares.length === 1')
assert js('window.vibeTest.activation') is True
assert js('window.vibeTest.publications') == 0
assert 'test-listener' not in js('window.vibeTest.shares[0].text')
assert js("(async()=>{const file=window.vibeTest.shares[0].files[0];const bitmap=await createImageBitmap(file);return [bitmap.width,bitmap.height,file.type]})()") == [1080, 1920, 'image/png']
assert js("document.querySelector('button[aria-label=\"Copy profile link\"]').disabled")
for look in ['Paper', 'Night', 'Signal', 'Your vibe']:
    click_button(look)
    ready_image()
    check_pixel([17, 102, 238])
capture_screenshot(OUT + 'vibe-story-desktop.png')
click_button('Top five')
ready_image()
assert js("localStorage.getItem('strummer-vibe-story-layout')") == 'ranked'
press_key('Escape')
assert js('window.vibeTest.closed')
assert js("document.activeElement.textContent.trim()") == 'Open test story'
click_button('Open test story')
ready_image()
assert js("Array.from(document.querySelectorAll('[role=tab]')).find(b=>b.textContent==='Top five').getAttribute('aria-selected')") == 'true'
for width, height in [(390, 844), (320, 740)]:
    cdp('Emulation.setDeviceMetricsOverride', width=width, height=height, deviceScaleFactor=1, mobile=True)
    time.sleep(0.3)
    assert js("document.querySelector('[role=dialog]').scrollWidth <= document.querySelector('[role=dialog]').clientWidth")
    for _ in range(15):
        press_key('Tab')
        assert js("!!document.activeElement.closest('[role=dialog]')")
    if width == 390:
        js("document.querySelector('[role=dialog]').scrollTop=0")
        capture_screenshot(OUT + 'vibe-story-mobile.png')
click_button('Song spotlight')
ready_image()
click_button('Share Story')
wait_for('window.vibeTest.shares.length === 2')
assert js('window.vibeTest.activation') is True
assert js('window.vibeTest.publications') == 0
print(json.dumps({'result': 'PASS', 'checks': [
    'corrupt session recovery', 'creative data retained', 'desktop/mobile overflow',
    'keyboard focus and dialog trap', 'all story themes', 'selected artwork',
    '1080x1920 PNG', 'private image sharing', 'user activation retained',
    'no automatic publishing', 'preference persistence', 'Escape restores focus',
]}))
