import ipaddr from 'ipaddr.js';
export function isPublicIp(raw: string): boolean {
 try {
  let address = ipaddr.parse(raw.replace(/^\[|\]$/g,''));
  if (address.kind()==='ipv6' && (address as ipaddr.IPv6).isIPv4MappedAddress()) address=(address as ipaddr.IPv6).toIPv4Address();
  // Reject private, loopback, link local, CGNAT, reserved, multicast and translation/tunnel ranges.
  return address.range()==='unicast';
 } catch {return false;}
}
export function validatePublicUrl(raw: string): URL {
 const url = new URL(raw);
 const host=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
 if (!['http:','https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port))) throw new Error('URL not permitted');
 if (host==='localhost' || !host.includes('.') || /\.(localhost|local|internal|test|invalid)$/.test(host) || host==='metadata.google.internal') throw new Error('URL not permitted');
 if (ipaddr.isValid(host) && !isPublicIp(host)) throw new Error('URL not permitted');
 url.hash='';
 return url;
}