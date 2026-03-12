import Pusher from "pusher";

const pusher = new Pusher({
  appId: "2126799",
  key: "7e27b79bda1f3319d427",
  secret: process.env.PUSHER_KEY, // Pindahkan ke ENV nanti!
  cluster: "ap1",
  useTLS: true
});

export default pusher;