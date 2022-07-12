// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Import this file to use console.log
import "hardhat/console.sol";
contract Attendance {
    // The state of this particular deployment
    enum LocalState {
        Floating,
        Enabled,
        Disabled
    }

    LocalState public state;

    uint public date;
    string public courseId;
    address public owner;

    uint public totalAttendance;
    mapping(address => string) private adrsToStudentId;
    mapping(string => bool) private studentIdToAdrs;

    event EnabledAttendence(address instructor, string courseId, uint date);
    event DisabledAttendence(address instructor, string courseId, uint date);

    constructor(string memory _courseId, uint _date) {
        require((bytes(_courseId)).length > 0, "missing _courseId");
        require(_date > block.timestamp, "_date must be in the future");

        state = LocalState.Floating;

        date = _date;
        courseId = _courseId;
        owner = msg.sender;
    }

    function enable() public {
        require(owner == msg.sender, "method reserved for owner");
        require(state == LocalState.Floating, "cannot be enabled");

        state = LocalState.Enabled;

        emit EnabledAttendence(owner, courseId, date);
    }

    function disable() public {
        require(owner == msg.sender, "method reserved for owner");
        require(state == LocalState.Enabled, "cannot be disabled");

        state = LocalState.Disabled;

        emit DisabledAttendence(owner, courseId, date);
    }

    function giveAttendance(string memory _studentId) public {
        require(state == LocalState.Enabled, "not taking attendance");
        require(
            bytes(adrsToStudentId[msg.sender]).length == 0,
            "already given"
        );

        adrsToStudentId[msg.sender] = _studentId;
        studentIdToAdrs[_studentId] = true;
        totalAttendance++;
    }

    function checkAttendance() public view returns (string memory) {
        return adrsToStudentId[msg.sender];
    }

    function checkAttendanceByStudentId(string memory _studentId)
        public
        view
        returns (bool)
    {
        require(owner == msg.sender, "method reserved for owner");

        return studentIdToAdrs[_studentId];
    }
}
