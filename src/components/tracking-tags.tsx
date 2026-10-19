import Script from "next/script";
import { CustomCode } from "./custom-code";

/* The tags a public site or funnel page carries: Google Analytics, the Meta Pixel and any code the agency pasted. */

export interface Tracking {
  gaId?: string;
  metaPixelId?: string;
  headCode?: string;
  bodyCode?: string;
}

export function TrackingTags({ gaId, metaPixelId, headCode, bodyCode }: Tracking) {
  return (
    <>
      {gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${JSON.stringify(gaId)});`}</Script>
        </>
      )}
      {metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(metaPixelId)});fbq('track','PageView');`}</Script>
      )}
      <CustomCode html={headCode} target="head" />
      <CustomCode html={bodyCode} target="body" />
    </>
  );
}
