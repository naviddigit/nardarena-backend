import { Request } from '@nestjs/common';
const UAParser = require('ua-parser-js');

/**
 * 🌍 Device & Location Detection Utility
 * 
 * Extracts:
 * - IP address
 * - Device type (iPhone, Samsung, etc.)
 * - Operating system (iOS 16, Android 13, etc.)
 * - Browser (Chrome 120, Safari 17, etc.)
 */

export interface DeviceInfo {
  ip: string;
  device: string;
  os: string;
  browser: string;
  userAgent: string;
}

/**
 * Extract IP address from request
 * Handles proxies (x-forwarded-for, x-real-ip)
 */
export function getClientIp(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  
  if (forwarded) {
    // x-forwarded-for can be comma-separated list of IPs
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  // Fallback to socket remote address
  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

/**
 * Parse User-Agent and extract device info
 */
export function getDeviceInfo(req: any): DeviceInfo {
  const userAgent = req.headers['user-agent'] || '';
  const parser = new UAParser(userAgent);
  
  const result = parser.getResult();
  
  // Extract device name (e.g., "iPhone", "Samsung Galaxy S21")
  let device = 'Unknown Device';
  if (result.device.vendor && result.device.model) {
    device = `${result.device.vendor} ${result.device.model}`;
  } else if (result.device.vendor) {
    device = result.device.vendor;
  } else if (result.device.type) {
    device = result.device.type; // 'mobile', 'tablet', 'desktop'
  }
  
  // Extract OS (e.g., "iOS 16.5", "Android 13")
  let os = 'Unknown OS';
  if (result.os.name && result.os.version) {
    os = `${result.os.name} ${result.os.version}`;
  } else if (result.os.name) {
    os = result.os.name;
  }
  
  // Extract Browser (e.g., "Chrome 120.0", "Safari 17.1")
  let browser = 'Unknown Browser';
  if (result.browser.name && result.browser.version) {
    browser = `${result.browser.name} ${result.browser.version}`;
  } else if (result.browser.name) {
    browser = result.browser.name;
  }
  
  return {
    ip: getClientIp(req),
    device,
    os,
    browser,
    userAgent,
  };
}

/**
 * Get country code from IP address using free IP geolocation API
 * Uses: https://ipapi.co (free, no API key needed)
 * 
 * Note: For production, consider:
 * - MaxMind GeoIP2 (more accurate, requires database file)
 * - ipinfo.io (requires API key)
 * - Abstract API (requires API key)
 */
export async function getCountryFromIp(ip: string): Promise<string | null> {
  try {
    // Skip local IPs
    if (ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip === '::1') {
      return null;
    }
    
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.country_code || null; // Returns 'US', 'IR', etc.
  } catch (error) {
    console.error('Failed to detect country from IP:', error);
    return null;
  }
}

/**
 * Get detailed location info from IP
 */
export interface LocationInfo {
  country: string | null;
  countryName: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
}

export async function getLocationFromIp(ip: string): Promise<LocationInfo> {
  try {
    // Skip local IPs
    if (ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip === '::1') {
      return {
        country: null,
        countryName: null,
        city: null,
        region: null,
        timezone: null,
      };
    }
    
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!response.ok) {
      return {
        country: null,
        countryName: null,
        city: null,
        region: null,
        timezone: null,
      };
    }
    
    const data = await response.json();
    
    return {
      country: data.country_code || null,
      countryName: data.country_name || null,
      city: data.city || null,
      region: data.region || null,
      timezone: data.timezone || null,
    };
  } catch (error) {
    console.error('Failed to get location from IP:', error);
    return {
      country: null,
      countryName: null,
      city: null,
      region: null,
      timezone: null,
    };
  }
}
