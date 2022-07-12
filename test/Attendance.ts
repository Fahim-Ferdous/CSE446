import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { randomBytes, Sign, sign } from "crypto";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Attendance", function () {
  const courseId = "course101";
  const date = (new Date()).getTime();
  const studentId = "id1234";

  let attendance: Contract;
  let owner: SignerWithAddress;
  let otherAccount: SignerWithAddress;
  let manySigners: SignerWithAddress[];

  let prepareEnv = async function () {
    // Contracts are deployed using the first signer/account by default
    [owner, otherAccount, ...manySigners] = (await ethers.getSigners()).slice(0, 4);

    const Attendance = await ethers.getContractFactory("Attendance");
    attendance = await Attendance.deploy(courseId, date);
  }

  describe("Deployment", function () {
    before(prepareEnv);
    it("right date", async function () {
      expect(await attendance.date()).to.equal(date);
    });

    it("right owner", async function () {
      expect(await attendance.owner()).to.equal(owner.address);
    });

    describe("fails if", async function () {
      it("course ID is empty", async function () {
        // We don't use the fixture here because we want a different deployment
        const Attendance = await ethers.getContractFactory("Attendance");
        await expect(Attendance.deploy("", date)).to.be.rejectedWith(
          "missing _courseId"
        );
      });
  
      it("date is not in the future", async function () {
        // We don't use the fixture here because we want a different deployment
        const date = 123456;
        const Attendance = await ethers.getContractFactory("Attendance");
        await expect(Attendance.deploy("course101", date)).to.be.rejectedWith(
          "_date must be in the future"
        );
      });
      
    })
  });

  describe("EnableDisable", function () {
    before(prepareEnv);
    // this.beforeEach(beforeEachCallbackFn)
    it("Should reject with the right error if attempted to enable from another account", async function () {
      await expect(attendance.connect(otherAccount).enable()).to.be.rejectedWith(
        "method reserved for owner"
      );
    });

    it("Should reject with the right error if attempted to disable without enabling", async function () {
      // console.log(await attendance.connect(owner).disable())
      await expect(attendance.connect(owner).disable()).to.be.rejectedWith(
        "cannot be disabled"
      );
    });

    it("Should emit event upon calling enable", async function () {
      await expect(attendance.connect(owner).enable()).to.emit(
        attendance, "EnabledAttendence"
      ).withArgs(owner.address, courseId, date);
    });

    it("Should reject with the right error if attempted to enable twice", async function () {
      await expect(attendance.connect(owner).enable()).to.be.rejectedWith(
        "cannot be enabled"
      );
    });

    it("Should reject with the right error if attempted to disable from another account", async function () {
      await expect(attendance.connect(otherAccount).disable()).to.be.rejectedWith(
        "method reserved for owner"
      );
    });

    it("Should emit event upon calling disable", async function () {
      await expect(attendance.connect(owner).disable()).to.emit(
        attendance, "DisabledAttendence"
      ).withArgs(owner.address, courseId, date);
    });

    it("Should reject with the right error if attempted to enable disabled", async function () {
      await expect(attendance.connect(owner).enable()).to.be.rejectedWith(
        "cannot be enabled"
      );
    });
  });

  describe("GiveAttendance", async function () {
    before(prepareEnv);
    it("fails", async function () {
      await expect(attendance.connect(otherAccount).giveAttendance("id1234")).to.be.rejectedWith(
        "not taking attendance"
      );
    });

    describe("enable", async function () {
      before(async function () {
        await attendance.connect(owner).enable();
      });

      it("doesn't fail first time", async function () {
        await expect(attendance.connect(otherAccount).giveAttendance(studentId)).to.be.not.rejected;
      });

      it("fails second time", async function () {
        await expect(attendance.connect(otherAccount).giveAttendance(studentId)).to.be.rejectedWith(
          "already given"
        );
      });

      describe("disable", async function () {
        before(async function () {
          await attendance.connect(owner).disable();
        });

        it("fails", async function () {
          await expect(attendance.connect(otherAccount).giveAttendance("id1234")).to.be.rejectedWith(
            "not taking attendance"
          );
        });
      });
    });
  });

  describe("CheckAttendance", function () {
    before(prepareEnv);

    it("returns empty string", async function () {
      expect(await attendance.connect(otherAccount).checkAttendance()).to.be.equal("");
    });

    describe("enable", async function () {
      before(async function () {
        await attendance.connect(owner).enable();
      })

      it("returns empty string", async function () {
        expect(await attendance.connect(otherAccount).checkAttendance()).to.be.equal("");
      });

      describe("attendance", async function () {
        before(async function () {
          await attendance.connect(otherAccount).giveAttendance(studentId);
        })


        describe("CheckAttendanceByStudentId", function () {
          it("returns true", async function () {
            expect(await attendance.connect(owner).checkAttendanceByStudentId(studentId)).to.be.equal(true);
          });

          it("returns false", async function () {
            expect(await attendance.connect(owner).checkAttendanceByStudentId(studentId + "gibberish")).to.be.equal(false);
          });
        });

        it("returns student ID", async function () {
          expect(await attendance.connect(otherAccount).checkAttendance()).to.be.equal(studentId);
        });

        describe("disable", async function () {
          before(async function () {
            await attendance.connect(owner).disable();
          })

          it("returns student ID", async function () {
            expect(await attendance.connect(otherAccount).checkAttendance()).to.be.equal(studentId);
          });
        });
      });
    });

    describe("enable and disable without attendance", async function () {
      before(prepareEnv);
      before(async function () {
        await attendance.connect(owner).enable();
      });

      it("returns empty string", async function () {
        expect(await attendance.connect(otherAccount).checkAttendance()).to.be.equal("");
      });
    });
  });

  describe("CheckAttendanceByStudentId", function () {
    before(prepareEnv);

    it("fails without owner", async function () {
      // TODO: checkAttendanceByStudentId
      await expect(attendance.connect(otherAccount).checkAttendanceByStudentId(studentId)).to.be.rejectedWith(
        "method reserved for owner"
      );
    });
  });

  describe("TotalAttendance", function () {
    before(prepareEnv);

    describe("enable", async function () {
      before(async function () {
        await attendance.connect(owner).enable();
      });

      it("is zero", async function () {
        expect(await attendance.connect(otherAccount).totalAttendance()).to.be.equal(0);
      });

      describe("multiple calls", async function () {
        before(async function () {
          for (let i = 0; i < manySigners.length; i++) {
            await attendance.connect(manySigners[i]).giveAttendance(studentId + i);
          }
        });

        it("preserves counter", async function () {
          expect(await attendance.connect(otherAccount).totalAttendance()).to.be.equal(manySigners.length);
        });

        describe("disable", async function () {
          before(async function () {
            await attendance.connect(owner).disable();
          });

          it("preserves counter", async function () {
            expect(await attendance.connect(otherAccount).totalAttendance()).to.be.equal(manySigners.length);
          });
        });
      });
    });
  });
});