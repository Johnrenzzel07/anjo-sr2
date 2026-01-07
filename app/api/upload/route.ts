import { NextRequest, NextResponse } from "next/server";
import { s3Client } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getAuthUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const user = getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileExtension = file.name.split(".").pop();
        const fileName = `attachments/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;

        const bucketName = process.env.DO_SPACES_BUCKET || "anjo-sr";

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fileName,
            Body: buffer,
            ContentType: file.type,
            ACL: "public-read",
        });

        await s3Client.send(command);

        const fileUrl = `${process.env.DO_SPACES_URL}/${fileName}`;

        return NextResponse.json({ url: fileUrl });
    } catch (error: any) {
        console.error("Error uploading to Spaces:", error);
        return NextResponse.json(
            { error: error.message || "Failed to upload file" },
            { status: 500 }
        );
    }
}
