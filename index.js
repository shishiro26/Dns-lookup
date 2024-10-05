const dgram = require("dgram");
const server = dgram.createSocket("udp4");

const createDNSQueryPacket = (domain) => {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(0x1234, 0);
  header.writeUInt16BE(0x0100, 2);
  header.writeUInt16BE(1, 4);
  header.writeUInt16BE(0, 6);
  header.writeUInt16BE(0, 8);
  header.writeUInt16BE(0, 10);

  const question = Buffer.concat([
    encodeDomain(domain),
    Buffer.from([0x00, 0x01]),
    Buffer.from([0x00, 0x01]),
  ]);

  return Buffer.concat([header, question]);
};

const encodeDomain = (domain) => {
  return Buffer.concat(
    domain
      .split(".")
      .map((part) => {
        const buf = Buffer.alloc(part.length + 1);
        buf.writeUInt8(part.length, 0);
        buf.write(part, 1);
        return buf;
      })
      .concat([Buffer.from([0])])
  );
};

const decodeDNSResponse = (msg) => {
  const answerCount = msg.readUInt16BE(6);
  let offset = 12;

  while (msg[offset] !== 0) {
    offset += msg[offset] + 1;
    if (offset >= msg.length) {
      console.error(
        "Error: Offset exceeded message length while parsing question section."
      );
      return [];
    }
  }
  offset += 5;

  const ipAddresses = [];

  for (let i = 0; i < answerCount; i++) {
    let nameOffset = msg.readUInt16BE(offset);
    if ((nameOffset & 0xc000) === 0xc000) {
      nameOffset = nameOffset & 0x3fff;
    }

    const type = msg.readUInt16BE(offset + 2);
    const classType = msg.readUInt16BE(offset + 4);
    const ttl = msg.readUInt32BE(offset + 6);
    const dataLength = msg.readUInt16BE(offset + 10);

    const ipBuffer = msg.slice(offset + 12, offset + 12 + dataLength);
    const ipAddress = Array.from(ipBuffer).join(".");
    ipAddresses.push(ipAddress);

    offset += 12 + dataLength;

    if (offset >= msg.length) {
      console.error(
        "Error: Offset exceeded message length while parsing answer section."
      );
      break;
    }
  }

  return ipAddresses;
};

const sendDNSQuery = (domain) => {
  const packet = createDNSQueryPacket(domain);
  server.send(packet, 53, "8.8.8.8", (err) => {
    if (err) console.error("Error sending query:", err);
    else console.log(`DNS query sent for domain: ${domain}`);
  });
};

server.on("message", (msg) => {
  console.log("Received DNS response:", msg);
  const ipAddresses = decodeDNSResponse(msg);
  console.log("IP Addresses:", ipAddresses.join(", "));
  server.close();
});

const getInput = (promptText, callback) => {
  process.stdout.write(promptText);
  process.stdin.once("data", (data) => {
    callback(data.toString().trim());
  });
};

getInput("Enter a domain to resolve: ", (domain) => {
  sendDNSQuery(domain);
});
