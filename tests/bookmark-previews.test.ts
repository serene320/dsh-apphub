import {test} from 'node:test'
import assert from 'node:assert/strict'
import {extractPreview,publicImageAddress,fetchPublicImage} from '../src/adapter/host/bookmark-previews.ts'
test('preview extracts inert metadata and resolves relative images without executing HTML',()=>{
 const p=extractPreview('<title>Fallback</title><meta property="og:title" content="Site"><meta property="og:image" content="/cover.png"><meta name="description" content="Description"><link rel="icon" href="javascript:bad"><script>throw 1</script>','https://example.com/docs')
 assert.deepEqual(p,{title:'Site',description:'Description',image:'https://example.com/cover.png',icon:''})
})
test('image fetch rejects private, loopback, fake-IP and translation addresses',async()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','192.168.1.1','169.254.169.254','198.18.0.178','::1','::ffff:127.0.0.1','64:ff9b::7f00:1'])assert.equal(publicImageAddress(ip),false)
 assert.equal(publicImageAddress('8.8.8.8'),true)
 await assert.rejects(fetchPublicImage('http://127.0.0.1/x',AbortSignal.timeout(1000)),/公网/)
})
