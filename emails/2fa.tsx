import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface TwoFactorEmailProps {
  logoUrl?: string;
  code: string;
  username?: string;
  expiresInMinutes?: number;
  /** 一鍵登入連結；若有，使用者點 link 即可跳過手動輸入。 */
  magicLink?: string;
  orgName?: string;
}

export default function TwoFactorEmail({
  logoUrl,
  code,
  username = "",
  expiresInMinutes = 10,
  magicLink,
  orgName = "Heiso",
}: TwoFactorEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your {orgName} verification code: {code}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-[#f6f9fc] font-sans p-2">
          <Container className="mx-auto my-[40px] max-w-[500px] rounded border border-solid border-[#f0f0f0] bg-white p-[45px]">
            {logoUrl && (
              <Section className="mt-[8px] text-center">
                <Img
                  src={logoUrl}
                  width="40"
                  height="40"
                  alt={`${orgName} Logo`}
                  className="mx-auto my-0"
                />
              </Section>
            )}

            <Heading className="mx-0 my-[30px] p-0 text-center text-[24px] font-normal text-black">
              Sign in to <strong>{orgName}</strong>
            </Heading>

            {username && (
              <Text className="text-[16px] leading-[24px] text-[#404040] text-center">
                Hi {username}, here is your verification code.
              </Text>
            )}

            <Section className="my-[24px] rounded-lg bg-[#f6f9fc] py-[20px] text-center">
              <Text className="m-0 font-mono text-[32px] font-bold tracking-[10px] text-black">
                {code}
              </Text>
            </Section>

            {magicLink && (
              <Section className="my-[20px] text-center">
                <Link
                  href={magicLink}
                  className="text-[16px] font-semibold text-[#1d4ed8] underline"
                >
                  Use one-click sign-in →
                </Link>
              </Section>
            )}

            <Hr className="mx-0 my-[24px] w-full border border-solid border-[#e6ebf1]" />

            <Text className="text-[12px] leading-[20px] text-[#999999] text-center">
              This code and link expire in {expiresInMinutes} minutes. If you
              didn’t request this, you can safely ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

TwoFactorEmail.PreviewProps = {
  code: "123456",
  username: "Josh",
  expiresInMinutes: 10,
  magicLink: "https://example.com/login/2steps?email=user%40heiso.io&code=123456",
  orgName: "Heiso",
} as TwoFactorEmailProps;
