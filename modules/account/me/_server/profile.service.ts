"use server";

import { updateMember } from "@heiso-io/bee/lib/members/member-adapter";

/**
 * Update avatar
 * Core mode: Update members table
 * CMS mode: Requires cell DB
 */
export async function updateAvatar(userId: string, avatar: string) {
  try {
    await updateMember(userId, {
      avatar,
      updatedAt: new Date(),
    } as any);

    return {
      success: true,
      message: "Avatar updated successfully",
    };
  } catch (error) {
    console.error("Failed to update avatar:", error);

    return {
      success: false,
      error: "Failed to update avatar, please try again later",
    };
  }
}

/**
 * Update nickname
 * Core mode: Update members table
 * CMS mode: Requires cell DB
 */
export async function updateNickname(userId: string, name: string) {
  try {
    await updateMember(userId, {
      name,
      updatedAt: new Date(),
    } as any);

    return {
      success: true,
      message: "Nickname updated successfully",
    };
  } catch (error) {
    console.error("Failed to update nickname:", error);

    return {
      success: false,
      error: "Failed to update nickname, please try again later",
    };
  }
}
