const axios = require("axios");

const cookies = {
  ndus: "YvuYYdkpeHuihGw9OEigqSKA9NybL_DX5x74XMDz",
  ndut_fmt: "4CC0910C280E2FCEAFE54757CB673582F6AD3599E7774017843952D6EC551A16",
  browserid: "oIGAo4oY1Id2W3x1tciwWVawHj8vEf1jK48QhN6lbQmpu2jagQsDrYYzXOU=",
  lang: "en",
};

const headers = {
  "User-Agent": "Mozilla/5.0",
  Referer: "https://terabox.com",
};

module.exports = async (req, res) => {
  const shareUrl = req.query.url;
  if (!shareUrl || !shareUrl.includes("terabox.com/s/")) {
    return res.status(400).json({ error: "Invalid Terabox share URL" });
  }

  try {
    const cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    const htmlRes = await axios.get(shareUrl, {
      headers: {
        ...headers,
        Cookie: cookieHeader,
      },
    });

    const match = htmlRes.data.match(/window\.preload\s*=\s*(\{.*?\});/);
    if (!match) {
      return res.status(500).json({ error: "Failed to extract metadata" });
    }

    const preload = JSON.parse(match[1]);
    const file = preload?.shareInfo?.file_list?.[0];
    const fs_id = file?.fs_id;
    const uk = preload?.shareInfo?.uk;
    const shareid = preload?.shareInfo?.share_id;

    if (!fs_id || !uk || !shareid) {
      return res.status(500).json({ error: "Missing file metadata" });
    }

    const params = {
      app_id: "250528",
      channel: "dubox",
      clienttype: "0",
      web: "1",
      shareid,
      uk,
      fid_list: `[${fs_id}]`,
    };

    const dlinkRes = await axios.get("https://terabox.com/api/sharedownload", {
      headers: {
        ...headers,
        Cookie: cookieHeader,
      },
      params,
    });

    const dlink = dlinkRes.data?.list?.[0]?.dlink;
    if (!dlink) return res.status(500).json({ error: "Download link not found" });

    const finalRes = await axios.get(dlink, {
      maxRedirects: 0,
      validateStatus: status => status === 302,
      headers: {
        ...headers,
        Cookie: cookieHeader,
      },
    });

    const realUrl = finalRes.headers?.location;
    if (!realUrl) return res.status(500).json({ error: "Failed to fetch final URL" });

    return res.status(200).json({ direct_link: realUrl });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Something went wrong" });
  }
};
