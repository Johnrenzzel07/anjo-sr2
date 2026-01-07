import { S3Client } from "@aws-sdk/client-s3";

if (!process.env.DO_SPACES_KEY) {
    console.warn("DO_SPACES_KEY is not defined");
}

if (!process.env.DO_SPACES_SECRET) {
    console.warn("DO_SPACES_SECRET is not defined");
}

if (!process.env.DO_SPACES_ENDPOINT) {
    console.warn("DO_SPACES_ENDPOINT is not defined");
}

const s3Client = new S3Client({
    endpoint: process.env.DO_SPACES_ENDPOINT || "https://sgp1.digitaloceanspaces.com",
    forcePathStyle: false,
    region: "sgp1", // DigitalOcean Spaces requires a region, though it doesn't always use it
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY || "",
        secretAccessKey: process.env.DO_SPACES_SECRET || "",
    },
});

export { s3Client };
