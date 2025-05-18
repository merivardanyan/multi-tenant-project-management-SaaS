// placeholder - oauth not implemented yet
// would need passport.js + google/github strategies

const oauthConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: `${process.env.SERVER_URL}/api/auth/google/callback`,
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackUrl: `${process.env.SERVER_URL}/api/auth/github/callback`,
  },
};

module.exports = oauthConfig;
