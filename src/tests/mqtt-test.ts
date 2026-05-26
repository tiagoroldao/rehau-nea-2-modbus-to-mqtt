import mqtt from "mqtt";
const client = mqtt.connect({
  host: "homeassistant.local",
  port: 8883,
  username: "mqtt-explorer",
  password: "kasdjhgfl",
  protocol: "mqtts",
  rejectUnauthorized: false,
});

client.on("connect", () => {
  console.log("connected");
    client.subscribe("homeassistant/light/tiago_test_fake_light/#", (err) => {
      if (!err) {
        client.publish("homeassistant/light/tiago_test_fake_light/config", JSON.stringify(discovery_topic), {
            retain: true
        });
        client.publish("homeassistant/light/tiago_test_fake_light/state", 'OFF', {
            retain: true
        });

        client.publish("homeassistant/light/tiago_test_fake_light/availability", 'offline', {
            retain: true
        });
      }
    });
});

client.on("error", (e) => {
  console.log("error", e);
});

client.on("message", (topic, message) => {
  // message is Buffer
//   console.log(topic, message.toString());

  if (topic === 'homeassistant/light/tiago_test_fake_light/set') {
    console.log('SET STATE', message.toString())
    client.publish('homeassistant/light/tiago_test_fake_light/state', message.toString());
  }
});

const discovery_topic = {
  name: "Test Fake Light",
  unique_id: "tiago_test_fake_light",
  command_topic: "homeassistant/light/tiago_test_fake_light/set",
  state_topic: "homeassistant/light/tiago_test_fake_light/state",
  availability_topic: "homeassistant/light/tiago_test_fake_light/availability",
  brightness: false,
  device: {
    identifiers: ["tiago_test_fake_light_device_id"],
    name: "Test Fake Light",
    model: "Some Light",
    manufacturer: "DIY",
    sw_version: "1.0",
  },
};
