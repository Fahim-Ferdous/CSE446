import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { randomBytes, sign } from "crypto";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Attendance", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshopt in every test.
  async function deployAttendanceFixture() {
    const date = (new Date()).getTime();
    const courseId = "course101";

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const Attendance = await ethers.getContractFactory("Attendance");
    const attendance = await Attendance.deploy(courseId, date);

    return { attendance, courseId, date, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should set the right date", async function () {
      const { attendance, date } = await loadFixture(deployAttendanceFixture);

      expect(await attendance.date()).to.equal(date);
    });

    it("Should set the right owner", async function () {
      const { attendance, owner } = await loadFixture(deployAttendanceFixture);

      expect(await attendance.owner()).to.equal(owner.address);
    });

    it("Should fail if the course ID is empty", async function () {
      // We don't use the fixture here because we want a different deployment
      const date = 123456;
      const Attendance = await ethers.getContractFactory("Attendance");
      await expect(Attendance.deploy("", date)).to.be.rejectedWith(
        "missing _courseId"
      );
    });

    it("Should fail if the date is not in the future", async function () {
      // We don't use the fixture here because we want a different deployment
      const date = 123456;
      const Attendance = await ethers.getContractFactory("Attendance");
      await expect(Attendance.deploy("course101", date)).to.be.rejectedWith(
        "_date must be in the future"
      );
    });
  });


  describe("EnableDisable", function () {
    it("Should reject with the right error if attempted to enable from another account", async function () {
      const { attendance, otherAccount } = await loadFixture(
        deployAttendanceFixture
      );

      await expect(attendance.connect(otherAccount).enable()).to.be.rejectedWith(
        "method reserved for owner"
      );
    });

    it("Should reject with the right error if attempted to enable twice", async function () {
      const { attendance, owner } = await loadFixture(
        deployAttendanceFixture
      );

      // console.log("State:", await attendance.connect(owner).state());
      await expect(attendance.connect(owner).enable()).to.be.not.rejected;

      await expect(attendance.connect(owner).enable()).to.be.rejectedWith(
        "cannot be enabled"
      );
    });

    it("Should reject with the right error if attempted to disable from another account", async function () {
      const { attendance, otherAccount } = await loadFixture(
        deployAttendanceFixture
      );

      await expect(attendance.connect(otherAccount).disable()).to.be.rejectedWith(
        "method reserved for owner"
      );
    });

    it("Should reject with the right error if attempted to disable without enabling", async function () {
      const { attendance, owner } = await loadFixture(
        deployAttendanceFixture
      );

      // console.log(await attendance.connect(owner).disable())
      await expect(attendance.connect(owner).disable()).to.be.rejectedWith(
        "cannot be disabled"
      );
    });

    it("Should reject with the right error if attempted to enable after disabled", async function () {
      const { attendance, owner } = await loadFixture(
        deployAttendanceFixture
      );

      await expect(attendance.connect(owner).enable()).to.be.not.rejected;
      await expect(attendance.connect(owner).disable()).to.be.not.rejected;
      await expect(attendance.connect(owner).enable()).to.be.rejectedWith(
        "cannot be enabled"
      );
    });

    it("Should emit event upon calling enable", async function () {
      const { attendance, courseId, date, owner } = await loadFixture(
        deployAttendanceFixture
      );

      await expect(attendance.connect(owner).enable()).to.emit(
        attendance, "EnabledAttendence"
      ).withArgs(owner.address, courseId, date);
    });

    it("Should emit event upon calling disable", async function () {
      const { attendance, courseId, date, owner } = await loadFixture(
        deployAttendanceFixture
      );

      await expect(attendance.connect(owner).enable()).to.be.not.rejected;
      await expect(attendance.connect(owner).disable()).to.emit(
        attendance, "DisabledAttendence"
      ).withArgs(owner.address, courseId, date);
    });
  });

  describe("GiveAttendance", function () {
    it("Should reject with the right error if attempted to give attendance before enable", async function () {
      const { attendance, otherAccount } = await loadFixture(
        deployAttendanceFixture
      );

      await expect(attendance.connect(otherAccount).giveAttendance("id1234")).to.be.rejectedWith(
        "not taking attendance"
      );
    });

    it("Shouldn't fail if attempted to give attendance after enable", async function () {
      const { attendance, owner, otherAccount } = await loadFixture(
        deployAttendanceFixture
      );

      await expect(attendance.connect(owner).enable()).to.be.not.rejected;
      await expect(attendance.connect(otherAccount).giveAttendance("id1234")).to.be.not.rejected;
    });

    it("Shouldn't fail if attempted to give attendance more than once", async function () {
      const { attendance, owner, otherAccount } = await loadFixture(
        deployAttendanceFixture
      );

      await expect(attendance.connect(owner).enable()).to.be.not.rejected;
      await expect(attendance.connect(otherAccount).giveAttendance("id1234")).to.be.not.rejected;
      await expect(attendance.connect(otherAccount).giveAttendance("id1234")).to.be.rejectedWith(
        "already given"
      );
    });

    it("Should reject with the right error if attempted to give attendance after disable", async function () {
      const { attendance, owner, otherAccount } = await loadFixture(
        deployAttendanceFixture
      );

      await expect(attendance.connect(owner).enable()).to.be.not.rejected;
      await expect(attendance.connect(owner).disable()).to.be.not.rejected;
      await expect(attendance.connect(otherAccount).giveAttendance("id1234")).to.be.rejectedWith(
        "not taking attendance"
      );
    });
  });

  describe("CheckAttendance", function () {
    it("Should never fail if attempted to check attendance", async function () {
      const { attendance, owner, otherAccount } = await loadFixture(
        deployAttendanceFixture
      );

      const studentId = "id1234";

      // Check before enabling
      expect(await attendance.connect(otherAccount).checkAttendance()).to.be.equal("");

      // Check after enabling
      await expect(attendance.connect(owner).enable()).to.be.not.rejected;
      expect(await attendance.connect(otherAccount).checkAttendance()).to.be.equal("");

      // Check after giving attendance
      await expect(attendance.connect(otherAccount).giveAttendance(studentId)).to.be.not.rejected;
      expect(await attendance.connect(otherAccount).checkAttendance()).to.be.equal(studentId);

      // Check after disabling but already given attendance
      await expect(attendance.connect(owner).disable()).to.be.not.rejected;
      expect(await attendance.connect(otherAccount).checkAttendance()).to.be.equal(studentId);
    });
  });

  it("Should reject with the right error if attempted to check student ID from another account", async function () {
    const { attendance, otherAccount } = await loadFixture(
      deployAttendanceFixture
    );

    await expect(attendance.connect(otherAccount).disable()).to.be.rejectedWith(
      "method reserved for owner"
    );
  });

  it("Should never fail if attempted to check total attendance", async function () {
    const { attendance, owner, otherAccount } = await loadFixture(
      deployAttendanceFixture
    );

    const studentId = "id1234";

    // Check before enabling
    expect(await attendance.connect(otherAccount).totalAttendance()).to.be.equal(0);

    // Check after enabling
    await expect(attendance.connect(owner).enable()).to.be.not.rejected;
    expect(await attendance.connect(otherAccount).totalAttendance()).to.be.equal(0);


    // Get multiple accounts with funds
    let signers = await ethers.getSigners()
    for (let i = 0; i < signers.length; i++) {
      // Cheack after each giveAttendance call
      await expect(attendance.connect(signers[i]).giveAttendance(studentId+i)).to.be.not.rejected;
      expect(await attendance.connect(signers[i]).totalAttendance()).to.be.equal(i+1);
    }

    // Check after disabling
    await expect(attendance.connect(owner).disable()).to.be.not.rejected;
    expect(await attendance.connect(otherAccount).totalAttendance()).to.be.equal(signers.length);
  });
});
