import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find Daniel Owens
  const users = await prisma.user.findMany({
    where: { name: { contains: "Daniel", mode: "insensitive" } },
    include: { subscription: true }
  });
  
  console.log("Found users:", JSON.stringify(users.map(u => ({ id: u.id, name: u.name, email: u.email, sub: u.subscription })), null, 2));
  
  for (const user of users) {
    if (user.subscription && !user.subscription.promoCode) {
      await prisma.subscription.update({
        where: { id: user.subscription.id },
        data: { promoCode: "OTGFREE" }
      });
      console.log(`Updated ${user.name}'s subscription with promo code OTGFREE`);
    } else if (user.subscription?.promoCode) {
      console.log(`${user.name} already has promo code: ${user.subscription.promoCode}`);
    }
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
